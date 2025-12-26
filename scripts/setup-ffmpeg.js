const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const FFMPEG_DIR = path.join(__dirname, '../ffmpeg');
// Using a reliable release build
const FFMPEG_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
const ZIP_PATH = path.join(__dirname, '../ffmpeg-release-essentials.zip');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
            console.log(`File already exists: ${dest}`);
            resolve();
            return;
        }
        console.log(`Downloading ${url}...`);
        const get = (link) => {
            https.get(link, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303) {
                    get(response.headers.location);
                    return;
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                    return;
                }
                const file = fs.createWriteStream(dest);
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log('Download complete.');
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => { });
                reject(err);
            });
        };
        get(url);
    });
}

async function main() {
    if (!fs.existsSync(FFMPEG_DIR)) {
        fs.mkdirSync(FFMPEG_DIR, { recursive: true });
    } else {
        // checks if ffmpeg.exe exists
        if (fs.existsSync(path.join(FFMPEG_DIR, 'bin', 'ffmpeg.exe'))) {
            console.log('FFmpeg already installed.');
            return;
        }
    }

    try {
        // 1. Download
        await downloadFile(FFMPEG_URL, ZIP_PATH);

        // 2. Extract
        console.log('Extracting FFmpeg...');
        // Using PowerShell for extraction as it's built-in on Windows
        // The zip usually contains a root folder like 'ffmpeg-7.0-essentials_build'. 
        // We need to handle that.

        // Extract to a temp dir first
        const TEMP_DIR = path.join(__dirname, '../ffmpeg_temp');
        if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });

        execSync(`powershell -command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${TEMP_DIR}' -Force"`);

        // Find the bin folder
        const getDirectories = source =>
            fs.readdirSync(source, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

        const rootDirName = getDirectories(TEMP_DIR)[0]; // e.g., ffmpeg-release-essentials
        const binDir = path.join(TEMP_DIR, rootDirName, 'bin');

        // Copy bin/ffmpeg.exe and bin/ffprobe.exe to FFMPEG_DIR
        if (!fs.existsSync(path.join(FFMPEG_DIR, 'bin'))) fs.mkdirSync(path.join(FFMPEG_DIR, 'bin'));

        fs.copyFileSync(path.join(binDir, 'ffmpeg.exe'), path.join(FFMPEG_DIR, 'bin', 'ffmpeg.exe'));
        fs.copyFileSync(path.join(binDir, 'ffprobe.exe'), path.join(FFMPEG_DIR, 'bin', 'ffprobe.exe'));

        console.log('FFmpeg binaries copied.');

        // Cleanup
        fs.unlinkSync(ZIP_PATH);
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });

        console.log('FFmpeg setup complete.');

    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    }
}

main();
