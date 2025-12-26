const { spawn, execFile } = require('child_process');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

class FfmpegManager {
    constructor() {
        this.ffmpegProcess = null;
        this.pythonProcess = null;

        const rootDir = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../');

        this.ffmpegPath = path.join(rootDir, 'ffmpeg', 'bin', 'ffmpeg.exe');
        this.pythonPath = path.join(rootDir, 'python-runtime', 'python.exe');
        this.scriptPath = path.join(rootDir, 'python-scripts', 'stream_stt.py');
        this.conversionPromise = null;
    }

    async getAudioDevices() {
        return new Promise((resolve, reject) => {
            const args = ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'];
            const child = spawn(this.ffmpegPath, args);

            let output = '';

            child.stderr.on('data', (data) => {
                output += data.toString();
            });

            child.on('close', () => {
                // Parse output
                // [dshow @ ...]  "Microphone (Realtek Audio)"
                // [dshow @ ...]     Alternative name "@device_cm_{33D9A762-90C8-11D0-BD43-00A0C911CE86}\wave_{...}"

                const lines = output.split('\n');
                const devices = [];
                let isAudioSection = false;

                let currentDeviceToken = null;

                lines.forEach(line => {
                    // Update Section State
                    if (line.includes('DirectShow audio devices')) {
                        isAudioSection = true;
                    } else if (line.includes('DirectShow video devices')) {
                        isAudioSection = false;
                    }

                    // Check for Device Name line
                    // [dshow @ ...] "Microphone (Realtek Audio)"
                    const nameMatch = line.match(/\[dshow @ [^\]]+\] "([^"]+)"/);
                    if (nameMatch) {
                        const name = nameMatch[1];
                        if (name !== 'dummy' && !name.startsWith('@device_')) {
                            // If we are in audio section, we treat it as candidate
                            currentDeviceToken = { name, id: name };
                            // If line has (audio), confirm it immediately, though we wait for alt name
                            // But dshow output is: Name line, then optional Alt name line.
                            // Actually better to wait for next line to see if alt name exists
                            // But dshow output is: Name line, then optional Alt name line.
                            if (line.includes('(audio)') || (isAudioSection && !line.includes('(video)'))) {
                                // This is a valid audio device, add it. Its ID might be updated by the next line.
                                devices.push(currentDeviceToken);
                            } else {
                                currentDeviceToken = null; // Not an audio device, discard candidate
                            }
                        }
                    }

                    // Check for Alternative Name line (ID)
                    // [dshow @ ...]   Alternative name "@device_cm_{...}"
                    if (currentDeviceToken && line.includes('Alternative name')) {
                        const altMatch = line.match(/"([^"]+)"/);
                        if (altMatch) {
                            currentDeviceToken.id = altMatch[1];
                            console.log(`Updated device ID for ${currentDeviceToken.name} to ${currentDeviceToken.id}`);
                        }
                        // After processing the alt name, this device token is complete.
                        // We don't clear currentDeviceToken here, as the next line might be another device.
                        // It will be overwritten by the next nameMatch or remain null if no more devices.
                    }
                });

                resolve(devices);
            });

            child.on('error', (err) => {
                reject(err);
            });
        });
    }

    startRecording(device, outputPath, onTranscript) {
        // Force cleanup if previous processes exist
        if (this.ffmpegProcess) {
            try { this.ffmpegProcess.kill(); } catch (e) { }
            this.ffmpegProcess = null;
        }
        if (this.pythonProcess) {
            try { this.pythonProcess.kill(); } catch (e) { }
            this.pythonProcess = null;
        }

        console.log(`Starting recording with device: ${device}`);
        console.log(`Output path: ${outputPath}`);

        // 1. Start Python Whisper
        try {
            const pythonArgs = ['-u', this.scriptPath];

            this.pythonProcess = spawn(this.pythonPath, pythonArgs, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.pythonProcess.on('error', (err) => {
                console.error('Python process error:', err);
                this.pythonProcess = null;
            });

            this.pythonProcess.stdout.on('data', (data) => {
                const str = data.toString();
                const lines = str.split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        try {
                            const json = JSON.parse(line.trim());
                            if (json.text) {
                                onTranscript(json.text);
                            }
                        } catch (e) { }
                    }
                });
            });

            this.pythonProcess.stderr.on('data', (data) => {
                console.log(`[Python] ${data.toString().trim()}`);
            });

            this.pythonProcess.on('close', (code) => {
                console.log(`Python process exited with code ${code}`);
                // Don't nullify here immediately to avoid race conditions during stop sequence usually
            });

        } catch (e) {
            console.error('Failed to start Python:', e);
            throw e;
        }

        // 2. Start FFmpeg
        try {
            const ffmpegArgs = [
                '-f', 'dshow',
                '-i', `audio=${device}`,
                '-ac', '1',
                '-ar', '16000',
                // Apply volume amplification and split to two outputs
                '-filter_complex', '[0:a]volume=4.0,asplit[file_out][stream_out]',
                // Output 1: File (RAW PCM)
                '-map', '[file_out]',
                '-c:a', 'pcm_s16le',
                '-y',
                '-f', 's16le',
                `${outputPath}.raw`,
                // Output 2: Pipe
                '-map', '[stream_out]',
                '-c:a', 'pcm_s16le',
                '-f', 's16le',
                'pipe:1'
            ];

            this.ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs, {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            const currentFfmpeg = this.ffmpegProcess;

            // Pipe ffmpeg stdout to python stdin
            if (this.pythonProcess) {
                this.ffmpegProcess.stdout.pipe(this.pythonProcess.stdin);
            }

            // Log file setup
            const logDir = path.join(path.dirname(process.execPath), 'logs');
            if (!fs.existsSync(logDir)) {
                try { fs.mkdirSync(logDir, { recursive: true }); } catch (e) { }
            }
            const logPath = path.join(logDir, 'streaming-debug.log');
            const logStream = fs.createWriteStream(logPath, { flags: 'a' });

            // Python Error Handling & Logging
            if (this.pythonProcess) {
                this.pythonProcess.stdin.on('error', (err) => {
                    const msg = `Python stdin error: ${err.message}`;
                    console.error(msg);
                    try { logStream.write(`[${new Date().toISOString()}] [Python Error] ${msg}\n`); } catch (e) { }
                });

                this.pythonProcess.stderr.on('data', (data) => {
                    try { logStream.write(`[${new Date().toISOString()}] [Python] ${data.toString().trim()}\n`); } catch (e) { }
                });
            }

            // FFmpeg Logging
            this.ffmpegProcess.stderr.on('data', (data) => {
                // FFmpeg logs to stderr
                const msg = data.toString();
                // console.log(`[FFmpeg] ${msg}`);
                try { logStream.write(`[${new Date().toISOString()}] [FFmpeg] ${msg}`); } catch (e) { }
            });

            this.ffmpegProcess.on('close', (code) => {
                console.log(`FFmpeg process exited with code ${code}`);
                try { logStream.write(`[${new Date().toISOString()}] Exited with code ${code}\n`); } catch (e) { }

                // Only nullify if it's the same process
                if (this.ffmpegProcess === currentFfmpeg) {
                    this.ffmpegProcess = null;
                }

                // If ffmpeg dies, kill python too
                if (this.pythonProcess) {
                    try { this.pythonProcess.kill(); } catch (e) { }
                }

                // Post-process: Convert RAW to WAV
                const rawPath = `${outputPath}.raw`;
                if (fs.existsSync(rawPath)) {
                    try {
                        const stats = fs.statSync(rawPath);
                        try { logStream.write(`[${new Date().toISOString()}] RAW file size: ${stats.size} bytes\n`); } catch (e) { }
                        try { logStream.write(`[${new Date().toISOString()}] Converting RAW to WAV...\n`); } catch (e) { }

                        // Spawn new ffmpeg to convert
                        const convertArgs = [
                            '-f', 's16le',
                            '-ar', '16000',
                            '-ac', '1',
                            '-i', rawPath,
                            '-y',
                            outputPath
                        ];
                        const converter = spawn(this.ffmpegPath, convertArgs);

                        converter.stderr.on('data', (d) => {
                            try { logStream.write(`[${new Date().toISOString()}] [Converter] ${d.toString()}`); } catch (e) { }
                        });

                        converter.on('close', (convertCode) => {
                            try {
                                logStream.write(`[${new Date().toISOString()}] Conversion finished with code ${convertCode}\n`);
                                logStream.end();
                            } catch (e) { }

                            if (this.onRecordingStopResolve) {
                                this.onRecordingStopResolve();
                                this.onRecordingStopResolve = null;
                            }
                        });
                    } catch (e) {
                        console.error('Conversion error:', e);
                        if (this.onRecordingStopResolve) {
                            this.onRecordingStopResolve();
                            this.onRecordingStopResolve = null;
                        }
                        try { logStream.end(); } catch (e) { }
                    }
                } else {
                    try {
                        logStream.write(`[${new Date().toISOString()}] RAW file not found: ${rawPath}\n`);
                        logStream.end();
                    } catch (e) { }

                    if (this.onRecordingStopResolve) {
                        this.onRecordingStopResolve();
                        this.onRecordingStopResolve = null;
                    }
                }
            });

        } catch (e) {
            console.error('Failed to start FFmpeg:', e);
            if (this.pythonProcess) try { this.pythonProcess.kill(); } catch (e) { }
            this.pythonProcess = null;
            throw e;
        }
    }

    async stopRecording() {
        console.log('Stopping recording...');
        return new Promise((resolve) => {
            if (this.ffmpegProcess) {
                // Set resolve callback for when conversion finishes
                this.onRecordingStopResolve = resolve;
                this.ffmpegProcess.kill();
            } else {
                resolve();
            }

            // Ensure python is killed
            if (this.pythonProcess) {
                try { this.pythonProcess.kill(); } catch (e) { }
            }
        });
    }
}


module.exports = new FfmpegManager();
