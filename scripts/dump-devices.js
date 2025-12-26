const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '../');
const ffmpegPath = path.join(rootDir, 'ffmpeg', 'bin', 'ffmpeg.exe');
const outputPath = path.join(__dirname, 'device_debug.txt');

console.log('Testing FFmpeg Path:', ffmpegPath);

const child = spawn(ffmpegPath, ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']);
const fileStream = fs.createWriteStream(outputPath);

child.stderr.on('data', (data) => {
    fileStream.write(data);
    process.stdout.write(data);
});

child.on('close', (code) => {
    console.log(`\nClosed with code: ${code}`);
    fileStream.end();
});
