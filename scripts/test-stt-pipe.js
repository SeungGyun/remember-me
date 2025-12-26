const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const PYTHON_PATH = path.join(__dirname, '..', 'python-runtime', 'python.exe');
const SCRIPT_PATH = path.join(__dirname, '..', 'python-scripts', 'stream_stt.py');
const FFMPEG_PATH = path.join(__dirname, '..', 'dist', 'win-unpacked', 'resources', 'ffmpeg', 'bin', 'ffmpeg.exe');
const TEST_AUDIO = String.raw`C:\Users\ilhsk\AppData\Roaming\remember-me\recordings\meeting-1766722212057.wav`;

console.log('--- STT PIPE UNIT TEST ---');
console.log(`Audio: ${TEST_AUDIO}`);
console.log(`Python: ${SCRIPT_PATH}`);

// 1. Spwan Python STT script
const pythonProcess = spawn(PYTHON_PATH, [SCRIPT_PATH]);

pythonProcess.stderr.on('data', (data) => {
    console.log(`[Python Log]: ${data.toString().trim()}`);
});

pythonProcess.stdout.on('data', (data) => {
    console.log(`[Python Result]: ${data.toString().trim()}`);
});

pythonProcess.on('exit', (code) => {
    console.log(`Python process exited with code ${code}`);
});

// 2. Spawn FFmpeg to convert WAV to PCM and pipe to Python
// ffmpeg -i input.wav -f s16le -ac 1 -ar 16000 pipe:1
const ffmpegArgs = [
    '-i', TEST_AUDIO,
    '-f', 's16le',
    '-ac', '1',
    '-ar', '16000',
    'pipe:1'
];

const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);

ffmpegProcess.stdout.on('data', (data) => {
    // Pipe data to Python stdin
    if (pythonProcess.stdin.writable) {
        try {
            pythonProcess.stdin.write(data);
        } catch (e) {
            console.error('Pipe write error:', e.message);
        }
    }
});

pythonProcess.stdin.on('error', (err) => {
    // Ignore EPIPE
    if (err.code !== 'EPIPE') {
        console.error('Python Stdin Error:', err);
    }
});

ffmpegProcess.stderr.on('data', (data) => {
    // console.log(`[FFmpeg Log]: ${data}`); // Too noisy
});

ffmpegProcess.on('close', (code) => {
    console.log(`FFmpeg process finished with code ${code}`);
    setTimeout(() => {
        console.log('Closing Python process...');
        pythonProcess.kill();
    }, 5000); // Wait a bit for final transcript
});

console.log('Starting pipe test...');
