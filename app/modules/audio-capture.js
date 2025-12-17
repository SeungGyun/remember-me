const recorder = require('node-record-lpcm16');
const fs = require('fs');
const path = require('path');

class AudioCapture {
    constructor() {
        this.recording = null;
        this.fileStream = null;
    }

    start(filePath) {
        if (this.recording) {
            console.warn('Recording already in progress');
            return;
        }

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.fileStream = fs.createWriteStream(filePath, { encoding: 'binary' });

        // Note: Requires SoX on Windows/Linux or rec on macOS
        this.recording = recorder.record({
            sampleRate: 16000,
            threshold: 0,
            verbose: false,
            recordProgram: process.platform === 'win32' ? 'sox' : 'rec',
        });

        this.recording.stream().pipe(this.fileStream);
        console.log('Recording started:', filePath);
    }

    stop() {
        if (!this.recording) return;

        this.recording.stop();
        this.recording = null;
        this.fileStream = null;
        console.log('Recording stopped');
    }
}

module.exports = new AudioCapture();
