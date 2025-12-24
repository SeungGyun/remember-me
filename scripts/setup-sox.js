const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Project root directory
const ROOT_DIR = path.join(__dirname, '..');
const SOX_DIR = path.join(ROOT_DIR, 'sox');
const SOX_ZIP_PATH = path.join(ROOT_DIR, 'sox.zip');

// URL for Sox 14.4.2 (Last standard windows build)
// Using SourceForge or reliable mirror. 
// Direct link to SourceForge is tricky with redirects, using a GitHub mirror or similar might be safer but SourceForge is the official source.
// Alternative: using a reliable binary host. 
// Let's use the sourceforge link but handle redirects carefully, OR use a known working mirror if available.
// For stability, let's try the sourceforge link.
const SOX_URL = 'https://sourceforge.net/projects/sox/files/sox/14.4.2/sox-14.4.2-win32.zip/download';

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
            console.log(`File already exists: ${dest}`);
            resolve();
            return;
        }

        console.log(`Downloading ${url} to ${dest}...`);

        const get = (link) => {
            https.get(link, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
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
    if (!fs.existsSync(SOX_DIR)) fs.mkdirSync(SOX_DIR, { recursive: true });

    try {
        // 1. Download Sox
        // Use a temp zip file path
        if (!fs.existsSync(path.join(SOX_DIR, 'sox.exe'))) {
            await downloadFile(SOX_URL, SOX_ZIP_PATH);

            console.log('Unzipping...');
            try {
                // Remove existing
                // PowerShell Expand-Archive
                // Note: The zip usually contains a root folder like 'sox-14.4.2'. We need to flatten it or handle paths.
                // Let's unzip to root first.
                execSync(`powershell -command "Expand-Archive -Path '${SOX_ZIP_PATH}' -DestinationPath '${ROOT_DIR}' -Force"`);

                // Move files from 'sox-14.4.2' to 'sox'
                const contentDir = path.join(ROOT_DIR, 'sox-14.4.2');
                if (fs.existsSync(contentDir)) {
                    // Move files
                    const files = fs.readdirSync(contentDir);
                    for (const file of files) {
                        const src = path.join(contentDir, file);
                        const dest = path.join(SOX_DIR, file);
                        if (fs.existsSync(dest)) fs.unlinkSync(dest); // Overwrite
                        fs.renameSync(src, dest);
                    }
                    fs.rmdirSync(contentDir);
                }

                // Config sox path for info
                console.log('Sox setup complete.');

                // Cleanup zip
                fs.unlinkSync(SOX_ZIP_PATH);

            } catch (e) {
                console.error('Unzip failed:', e);
                throw e;
            }
        } else {
            console.log('Sox already exists.');
        }

    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    }
}

main();
