const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const dbModule = require('./modules/database');
const meetingRecorder = require('./modules/meeting-recorder');

const isDev = !app.isPackaged;
const logDir = path.join(path.dirname(process.execPath), 'logs');

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

function log(message) {
    if (!fs.existsSync(logDir)) {
        try { fs.mkdirSync(logDir, { recursive: true }); } catch (e) { }
    }
    const time = new Date().toISOString();
    const logLine = `[${time}] ${message}\n`;
    try {
        fs.appendFileSync(path.join(logDir, 'app.log'), logLine);
    } catch (e) {
        console.error(message);
    }
}

// Global error handlers
process.on('uncaughtException', (error) => {
    log(`Uncaught Exception: ${error.stack}`);
});

function createWindow() {
    log('Creating window...');
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // Permission handling for Microphone
    win.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
        log(`[Main] Permission check: ${permission} from ${requestingOrigin}`);
        if (permission === 'media') {
            return true;
        }
        return false;
    });

    win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        log(`[Main] Permission request: ${permission}`);
        if (permission === 'media') {
            callback(true);
            return;
        }
        callback(false);
    });

    // Check media access status (Windows/macOS)
    if (process.platform === 'darwin' || process.platform === 'win32') {
        try {
            const status = require('electron').systemPreferences.getMediaAccessStatus('microphone');
            log(`[Main] System Microphone Access Status: ${status}`);
        } catch (e) {
            log(`[Main] Failed to get media access status: ${e.message}`);
        }
    }

    if (isDev) {
        log('Loading dev URL: http://localhost:3000');
        win.loadURL('http://localhost:3000');
        win.webContents.openDevTools();
    } else {
        const distPath = path.join(__dirname, '../renderer-dist/index.html');
        log(`Loading production file: ${distPath}`);

        win.loadFile(distPath).catch(e => {
            log(`Failed to load file: ${e.message}`);
        });

        // Open DevTools in prod for debugging white screen
        // win.webContents.openDevTools(); 

        win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            log(`Failed to load: ${errorCode} - ${errorDescription}`);
        });

        win.webContents.on('crashed', () => {
            log('Renderer process crashed');
        });

        win.webContents.on('console-message', (event, level, message, line, sourceId) => {
            log(`[Renderer] ${message} (${sourceId}:${line})`);
        });

        // Check if file exists
        if (!fs.existsSync(distPath)) {
            log(`CRITICAL: Index file not found at ${distPath}`);
            const resourcePath = process.resourcesPath;
            log(`Resources Path: ${resourcePath}`);
            log(`__dirname: ${__dirname}`);
        }
    }
}

app.whenReady().then(() => {
    log('App ready. Initializing modules...');
    try {
        dbModule.initDatabase();
        log('Database initialized.');
        meetingRecorder.initialize();
        log('Recorder initialized.');
        createWindow();
    } catch (e) {
        log(`Init failed: ${e.stack}`);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
