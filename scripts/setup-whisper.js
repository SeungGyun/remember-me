const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const WHISPER_DIR = path.join(__dirname, '../whisper');
const MODELS_DIR = path.join(WHISPER_DIR, 'models');

const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin';
const MODEL_PATH = path.join(MODELS_DIR, 'ggml-medium.bin');

const BIN_URL = 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip';
const ZIP_PATH = path.join(WHISPER_DIR, 'whisper.zip');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
            const stats = fs.statSync(dest);
            if (stats.size > 1024) {
                console.log(`File already exists: ${dest}`);
                resolve();
                return;
            } else {
                console.log(`File exists but is too small (${stats.size} bytes). Re-downloading...`);
                fs.unlinkSync(dest);
            }
        }

        console.log(`Downloading ${url} to ${dest}...`);

        // Helper to handle redirects
        const get = (link) => {
            https.get(link, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    console.log(`Redirecting to ${response.headers.location}...`);
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
    if (!fs.existsSync(WHISPER_DIR)) fs.mkdirSync(WHISPER_DIR, { recursive: true });
    if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

    try {
        // 1. Download Model
        await downloadFile(MODEL_URL, MODEL_PATH);

        // 2. Download Binary
        if (!fs.existsSync(path.join(WHISPER_DIR, 'main.exe'))) {
            await downloadFile(BIN_URL, ZIP_PATH);
            console.log('Unzipping...');
            try {
                execSync(`tar -xf "${ZIP_PATH}" -C "${WHISPER_DIR}"`);
            } catch (e) {
                console.log('tar failed, trying powershell...');
                execSync(`powershell -command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${WHISPER_DIR}' -Force"`);
            }
        } else {
            console.log('whisper main.exe already exists.');
        }

    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    }
}

main();
