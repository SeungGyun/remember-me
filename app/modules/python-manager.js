const { execFile } = require('child_process');
const path = require('path');
const { app } = require('electron');

class PythonManager {
    constructor() {
        this.pythonPath = app.isPackaged
            ? path.join(process.resourcesPath, 'python-runtime', 'python.exe')
            : path.join(__dirname, '../../python-runtime/python.exe');

        this.scriptPath = app.isPackaged
            ? path.join(process.resourcesPath, 'python-scripts', 'diarize.py')
            : path.join(__dirname, '../../python-scripts/diarize.py');
    }

    runDiarization(wavPath) {
        return new Promise((resolve, reject) => {
            console.log('Running diarization on:', wavPath);
            console.log('Python:', this.pythonPath);
            console.log('Script:', this.scriptPath);

            // Environment variables for offline mode/token if needed
            // const env = { ...process.env, HF_TOKEN: '...' };

            execFile(this.pythonPath, [this.scriptPath, wavPath], {}, (error, stdout, stderr) => {
                if (error) {
                    console.error('Diarization error:', error);
                    console.error('Stderr:', stderr);
                    return reject(error);
                }

                try {
                    console.log('Diarization output:', stdout);
                    const result = JSON.parse(stdout);
                    if (result.error) {
                        reject(new Error(result.error));
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    console.error('Failed to parse JSON:', e);
                    reject(e);
                }
            });
        });
    }
}

module.exports = new PythonManager();
