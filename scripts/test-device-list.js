const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Mocking app for the test
const app = {
    isPackaged: false,
    getPath: () => __dirname
};

const rootDir = path.join(__dirname, '../');
const ffmpegPath = path.join(rootDir, 'ffmpeg', 'bin', 'ffmpeg.exe');

console.log('Testing FFmpeg Path:', ffmpegPath);

function getAudioDevices() {
    return new Promise((resolve, reject) => {
        const args = ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'];
        console.log('Running:', ffmpegPath, args.join(' '));

        const child = spawn(ffmpegPath, args);

        let output = '';

        child.stderr.on('data', (data) => {
            output += data.toString();
            process.stdout.write(data.toString()); // Print raw output to verify
        });

        child.on('close', (code) => {
            console.log('\n--- Parsing ---');
            const lines = output.split('\n');
            const devices = [];
            let isAudioSection = false;

            lines.forEach(line => {
                // Heuristic: Check for section headers
                if (line.includes('DirectShow audio devices')) {
                    isAudioSection = true;
                    console.log('[DEBUG] Found Audio Section Header');
                } else if (line.includes('DirectShow video devices')) {
                    isAudioSection = false;
                    console.log('[DEBUG] Found Video Section Header');
                }

                if (isAudioSection) {
                    const match = line.match(/"([^"]+)"/);
                    if (match) {
                        const name = match[1];
                        if (name !== 'dummy' && !name.startsWith('@device_')) {
                            console.log(`[DEBUG] Found Device: ${name}`);
                            devices.push({ name, id: name });
                        }
                    }
                }
            });

            resolve(devices);
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

getAudioDevices().then(devices => {
    console.log('\nDevices Found:', devices);
}).catch(err => {
    console.error('Error:', err);
});
