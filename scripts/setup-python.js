const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const PYTHON_DIR = path.join(__dirname, '../python-runtime');
// Windows Embedded Python 3.11.9
const PYTHON_URL = 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip';
const ZIP_PATH = path.join(__dirname, '../python-runtime.zip');

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
                if (response.statusCode === 301 || response.statusCode === 302) {
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
    if (!fs.existsSync(PYTHON_DIR)) fs.mkdirSync(PYTHON_DIR, { recursive: true });

    try {
        // 1. Download Python
        await downloadFile(PYTHON_URL, ZIP_PATH);

        // 2. Extract
        console.log('Extracting Python...');
        try {
            execSync(`powershell -command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${PYTHON_DIR}' -Force"`);
        } catch (e) {
            console.error('Extraction failed', e);
            process.exit(1);
        }

        // 3. Configure pth file to allow import site
        // Locate the ._pth file
        const pthFile = fs.readdirSync(PYTHON_DIR).find(f => f.endsWith('._pth'));
        if (pthFile) {
            const pthPath = path.join(PYTHON_DIR, pthFile);
            let content = fs.readFileSync(pthPath, 'utf8');
            // Uncomment 'import site'
            content = content.replace('#import site', 'import site');
            fs.writeFileSync(pthPath, content);
        }

        // 4. Get get-pip.py
        await downloadFile('https://bootstrap.pypa.io/get-pip.py', path.join(PYTHON_DIR, 'get-pip.py'));

        // 5. Install pip
        console.log('Installing pip...');
        execSync(`"${path.join(PYTHON_DIR, 'python.exe')}" "${path.join(PYTHON_DIR, 'get-pip.py')}"`);

        // 6. Install dependencies
        // Note: pyannote.audio requires torch. We should install CPU version of torch first to save space/compat.
        console.log('Installing dependencies...');

        // Install PyTorch CPU
        execSync(`"${path.join(PYTHON_DIR, 'python.exe')}" -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu`);

        // Install pyannote.audio and other deps
        execSync(`"${path.join(PYTHON_DIR, 'python.exe')}" -m pip install pyannote.audio onnxruntime numpy openai-whisper`);

        // 7. Fix distutils-precedence.pth issue in embedded python
        // This file is often created by setuptools and conflicts with embedded python's site configuration
        const sitePackages = path.join(PYTHON_DIR, 'Lib', 'site-packages');
        const distutilsPth = path.join(sitePackages, 'distutils-precedence.pth');
        if (fs.existsSync(distutilsPth)) {
            console.log('Removing problematic distutils-precedence.pth...');
            fs.unlinkSync(distutilsPth);
        }

        console.log('Python setup complete.');

    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    }
}

main();
