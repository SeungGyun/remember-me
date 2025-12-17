const { spawn } = require('child_process');
const path = require('path');
const { app } = require('electron');

class WhisperEngine {
    constructor() {
        this.process = null;
        // Assume binaries are in resources/whisper in prod, or root whisper/ in dev
        this.whisperPath = app.isPackaged
            ? path.join(process.resourcesPath, 'whisper')
            : path.join(__dirname, '../../whisper');

        this.modelPath = path.join(this.whisperPath, 'models', 'ggml-medium.bin');
        this.mainPath = path.join(this.whisperPath, 'main.exe');
    }

    start(wavFilePath, onTranscript) {
        if (this.process) {
            this.stop();
        }

        console.log('Starting Whisper Engine...');
        console.log('Binary:', this.mainPath);
        console.log('Model:', this.modelPath);
        console.log('Input:', wavFilePath);

        // whisper.cpp arguments:
        // -m model
        // -f file
        // -l ko (Korean)
        // --step 0 (real-time-like processing if we were streaming, but here we process file)
        // Actually for real-time with node-record-lpcm16 wrting to file, we might needed stream mode 
        // or just repeatedly process the growing file (inefficient) or use the stream interface of whisper.cpp?
        // 
        // Wait, the Architecture in plan says: "Audio Chunk Save -> Whisper". 
        // So we probably process chunks or use valid strategy.
        // 
        // But standard `main` takes a WAV file.
        // Ideally we pipe stdin -> whisper, but whisper.cpp main example reads from file usually.
        // Let's check `whisper.cpp` help. It supports reading from stdin with `-`.
        // 
        // Plan: 
        // We will spawn whisper reading from a file that is being written to? 
        // Or we will pipe the audio stream directly to whisper's stdin?
        // `node-record-lpcm16` gives a stream.
        // Let's try piping: record -> whisper stdin.

        const args = [
            '-m', this.modelPath,
            '-l', 'ko',
            '-t', '4',
            '-v', // verbose
            '--print-colors', // easier to parse? no, maybe harder.
            '-ps', // print special tokens?
            '-', // Read from stdin
        ];

        try {
            this.process = spawn(this.mainPath, args);

            this.process.stdout.on('data', (data) => {
                const str = data.toString();
                console.log('Whisper RAW:', str);
                // Parse stdout to find text
                // Whisper output format varies, but usually: [time] text
                // We need a robust parser.
                // For now, let's just pass raw text lines that look like transcripts.

                // Heuristic cleanup
                const lines = str.split('\n');
                lines.forEach(line => {
                    const cleaned = line.trim();
                    // Simple filter to avoid status messages
                    if (cleaned && !cleaned.startsWith('main:') && !cleaned.startsWith('whisper_')) {
                        onTranscript(cleaned);
                    }
                });
            });

            this.process.stderr.on('data', (data) => {
                console.error('Whisper STDERR:', data.toString());
            });

            this.process.on('close', (code) => {
                console.log(`Whisper process exited with code ${code}`);
                this.process = null;
            });

            return this.process.stdin; // Return stdin to write audio data to

        } catch (e) {
            console.error('Failed to spawn whisper:', e);
            return null;
        }
    }

    stop() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }
}

module.exports = new WhisperEngine();
