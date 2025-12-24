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

    start(audioStream, onTranscript) {
        if (this.process) {
            this.stop();
        }

        console.log('Starting Whisper Engine...');
        console.log('Binary:', this.mainPath);
        console.log('Model:', this.modelPath);

        // whisper.cpp arguments:
        // -m model
        // -l ko (Korean)
        // -t 4 (threads)
        // --step 0 (real-time-like processing if we were streaming, but here we process file)
        // -f - (Read from stdin)

        const args = [
            '-m', this.modelPath,
            '-l', 'ko',
            '-t', '4',
            '-v', // verbose
            '--print-colors',
            '-', // Read from stdin
        ];

        try {
            this.process = spawn(this.mainPath, args);

            if (audioStream) {
                audioStream.pipe(this.process.stdin);
            }

            this.process.stdout.on('data', (data) => {
                const str = data.toString();
                console.log('Whisper RAW:', str);

                // Heuristic cleanup
                const lines = str.split('\n');
                lines.forEach(line => {
                    const cleaned = line.trim();
                    // Simple filter to avoid status messages
                    if (cleaned && !cleaned.startsWith('main:') && !cleaned.startsWith('whisper_') && !cleaned.startsWith('[kafka]')) {
                        // Removing timestamps if present [00:00:00.000 --> 00:00:00.000]
                        // But maybe we want them? For now just raw text.
                        // Regex to strip timestamps might be good, but let's see output first.
                        onTranscript(cleaned);
                    }
                });
            });

            this.process.stderr.on('data', (data) => {
                // Whisper prints a lot to stderr
                // console.error('Whisper STDERR:', data.toString());
            });

            this.process.on('close', (code) => {
                console.log(`Whisper process exited with code ${code}`);
                this.process = null;
            });

            return this.process;

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
