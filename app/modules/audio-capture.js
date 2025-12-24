const recorder = require('node-record-lpcm16');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { spawn } = require('child_process');

class AudioCapture {
    constructor() {
        this.recording = null;
        this.stream = null;
    }

    getSoxPath() {
        // In production, resources/sox/sox.exe
        // In dev, root/sox/sox.exe
        const basePath = app.isPackaged
            ? path.join(process.resourcesPath, 'sox')
            : path.join(__dirname, '../../sox');

        const soxPath = path.join(basePath, 'sox.exe');
        console.log('[AudioCapture] Using Sox at:', soxPath);
        // Cache it or just log? Logging every time might be noisy if called often, but okay for start/stop.
        return soxPath;
    }

    async start() {
        if (this.recording) {
            console.warn('[AudioCapture] Recording in progress, force stopping for new session');
            this.stop();
        }

        try {
            const soxPath = this.getSoxPath();

            // Debug Log Path Configuration
            let logDir;
            if (app.isPackaged) {
                // Production: Use 'logs' folder next to the executable
                logDir = path.join(path.dirname(app.getPath('exe')), 'logs');
            } else {
                // Development: Use 'logs' folder in project root
                logDir = path.join(__dirname, '../../logs');
            }

            if (!fs.existsSync(logDir)) {
                try {
                    fs.mkdirSync(logDir, { recursive: true });
                } catch (e) {
                    console.error('Failed to create log dir:', e);
                    // Fallback to userData if permission denied
                    logDir = app.getPath('userData');
                }
            }

            const logPath = path.join(logDir, 'sox-debug.log');
            const log = (msg) => {
                try {
                    fs.appendFileSync(logPath, msg + '\n');
                } catch (e) {
                    // Ignore logging errors
                }
            };

            log(`[${new Date().toISOString()}] Attempting to spawn Sox at: ${soxPath}`);
            if (!fs.existsSync(soxPath)) {
                log('FATAL: Sox executable not found at path!');
                throw new Error(`Sox binary missing at ${soxPath}`);
            }

            // Record from default device using explicit waveaudio driver
            const args = [
                '-V3',              // Verbose logging to catch device info
                '-t', 'waveaudio', 'default',
                '-t', 'wav',
                '-r', '16000',
                '-c', '1',
                '-b', '16',
                '-'
            ];

            log(`Args: ${args.join(' ')}`);

            this.recording = spawn(soxPath, args);

            if (this.recording.pid) {
                console.log('[AudioCapture] Record process started with PID:', this.recording.pid);
            }

            this.recording.stderr.on('data', (d) => {
                log(`[Sox Stderr]: ${d.toString().trim()}`);
            });

            this.recording.on('error', (err) => {
                log(`[Spawn Error]: ${err.message}`);
                console.error('[AudioCapture] Process error:', err);
            });

            this.recording.on('close', (code) => {
                log(`[Sox Exit]: Code ${code}`);
                console.log('[AudioCapture] Process exited with code:', code);
            });

            this.stream = this.recording.stdout;
            return this.stream;

        } catch (e) {
            console.error('[AudioCapture] Failed to start:', e);
            throw e;
        }
    }

    stop() {
        if (!this.recording) return;

        console.log('[AudioCapture] Stopping...');
        // graceful stop? SIGINT?
        this.recording.kill();

        if (this.stream) {
            this.stream.destroy();
        }

        this.recording = null;
        this.stream = null;
        console.log('[AudioCapture] Stopped');
    }
}

module.exports = new AudioCapture();
