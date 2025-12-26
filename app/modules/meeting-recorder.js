const ffmpegManager = require('./ffmpeg-manager');
const pythonManager = require('./python-manager');
const path = require('path');
const { app, ipcMain } = require('electron');
const dbModule = require('./database');

class MeetingRecorder {
    constructor() {
        this.isRecording = false;
        this.currentMeetingId = null;
        this.meetingStartTime = null;
        this.currentRecordingPath = null;
    }

    // Called from Main Process
    initialize() {
        ipcMain.handle('start-meeting', async (event, { title, room }) => {
            return this.start(title, room);
        });

        ipcMain.handle('stop-meeting', async () => {
            return this.stop();
        });

        ipcMain.handle('get-input-devices', async () => {
            try {
                return await ffmpegManager.getAudioDevices();
            } catch (e) {
                console.error('Failed to get devices:', e);
                return [];
            }
        });

        ipcMain.on('audio-data', (event, chunk) => {
            // Deprecated
        });

        ipcMain.handle('update-transcript', async (event, { id, text }) => {
            const db = dbModule.getDb();
            db.prepare('UPDATE transcripts SET text = ?, is_edited = 1, edited_text = ? WHERE id = ?').run(text, text, id);
            return { success: true };
        });

        ipcMain.handle('update-speaker', async (event, { meetingId, label, name }) => {
            const db = dbModule.getDb();
            // Update name for all participants with this label in this meeting
            db.prepare('UPDATE participants SET name = ? WHERE meeting_id = ? AND speaker_label = ?').run(name, meetingId, label);
            return { success: true };
        });

        ipcMain.handle('get-participants', async (event, { meetingId }) => {
            const db = dbModule.getDb();
            const participants = db.prepare('SELECT DISTINCT name, speaker_label FROM participants WHERE meeting_id = ?').all(meetingId);
            return participants;
        });

        ipcMain.handle('get-meetings', async () => {
            const db = dbModule.getDb();
            return db.prepare('SELECT * FROM meetings ORDER BY start_time DESC').all();
        });

        ipcMain.handle('get-transcripts', async (event, { meetingId }) => {
            const db = dbModule.getDb();
            return db.prepare('SELECT * FROM transcripts WHERE meeting_id = ? ORDER BY start_time ASC').all(meetingId);
        });

        // Search meetings by title or transcript content
        ipcMain.handle('search-meetings', async (event, { query }) => {
            const db = dbModule.getDb();
            const searchTerm = `%${query}%`;
            return db.prepare(`
                SELECT DISTINCT m.* 
                FROM meetings m
                LEFT JOIN transcripts t ON m.id = t.meeting_id
                WHERE m.title LIKE ? OR t.text LIKE ?
                ORDER BY m.start_time DESC
            `).all(searchTerm, searchTerm);
        });

        ipcMain.handle('search-transcripts', async (event, { query }) => {
            const db = dbModule.getDb();
            return db.prepare('SELECT t.*, m.title as meeting_title FROM transcripts t JOIN meetings m ON t.meeting_id = m.id WHERE t.text LIKE ? ORDER BY t.created_at DESC').all(`%${query}%`);
        });

        ipcMain.handle('export-meeting', async (event, { meetingId }) => {
            const db = dbModule.getDb();
            const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
            const transcripts = db.prepare(`
                SELECT t.text, t.start_time, p.name as speaker_name 
                FROM transcripts t 
                LEFT JOIN participants p ON t.speaker_id = p.id 
                WHERE t.meeting_id = ? 
                ORDER BY t.start_time ASC
            `).all(meetingId);

            const fs = require('fs');
            const { dialog } = require('electron');

            const { filePath } = await dialog.showSaveDialog({
                title: '회의록 내보내기',
                defaultPath: `${meeting.title}.txt`,
                filters: [{ name: 'Text Files', extensions: ['txt'] }]
            });

            if (filePath) {
                const content = transcripts.map(t => {
                    const time = new Date(t.start_time * 1000).toISOString().substr(11, 8);
                    const speaker = t.speaker_name || 'Unknown';
                    return `[${time}] ${speaker}: ${t.text}`;
                }).join('\n');

                fs.writeFileSync(filePath, content);
                return { success: true, filePath };
            }
            return { success: false };
        });
    }

    async start(title, room, deviceName) {
        if (this.isRecording) return { success: false, message: 'Already recording' };

        try {
            // Get device if not provided (default behavior)
            if (!deviceName) {
                const devices = await ffmpegManager.getAudioDevices();
                if (devices.length > 0) {
                    deviceName = devices[0].name;
                    console.log('No device specified, using first found:', deviceName);
                } else {
                    throw new Error('No input devices found');
                }
            }

            const db = dbModule.getDb();
            const stmt = db.prepare('INSERT INTO meetings (title, room, audio_path) VALUES (?, ?, ?)');

            // Generate filename
            const filename = `meeting-${Date.now()}.wav`;
            const recordingPath = path.join(app.getPath('userData'), 'recordings', filename);

            // Ensure directory exists
            const fs = require('fs');
            const dir = path.dirname(recordingPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const info = stmt.run(title, room, recordingPath);
            this.currentMeetingId = info.lastInsertRowid;
            this.meetingStartTime = Date.now();
            this.currentRecordingPath = recordingPath;

            this.isRecording = true;

            // Start Recording via FFmpegManager
            try {
                ffmpegManager.startRecording(deviceName, recordingPath, (text) => {
                    this.handleTranscript(text);
                });
            } catch (videoError) {
                console.error("FFmpeg Error", videoError);
                throw videoError;
            }

            // Notify Renderer
            this.broadcastStatus({ recording: true, meetingId: this.currentMeetingId });

            return { success: true, meetingId: this.currentMeetingId };
        } catch (e) {
            console.error('Failed to start meeting:', e);
            this.isRecording = false; // Reset flag
            return { success: false, error: e.message };
        }
    }


    async stop() {
        if (!this.isRecording) return { success: false };

        try {
            // Stop recording (and wait for conversion)
            await ffmpegManager.stopRecording();

            // Wait a bit more just in case
            await new Promise(r => setTimeout(r, 500));

            const meetingId = this.currentMeetingId;
            const recordingPath = this.currentRecordingPath;

            // Calculate duration
            const endTime = Date.now();
            const durationMs = endTime - this.meetingStartTime;
            const durationSec = Math.round(durationMs / 1000);

            const db = dbModule.getDb();
            try {
                db.prepare('UPDATE meetings SET end_time = ?, duration = ? WHERE id = ?')
                    .run(new Date(endTime).toISOString(), durationSec, meetingId);
            } catch (dbErr) {
                console.error('Failed to update meeting duration:', dbErr);
            }

            this.currentMeetingId = null;
            this.meetingStartTime = null;
            this.currentRecordingPath = null;
            this.isRecording = false;

            this.broadcastStatus({ recording: false, processing: true });

            // Run Diarization Async (Fire and Forget)
            if (meetingId && recordingPath) {
                (async () => {
                    try {
                        const fs = require('fs');
                        if (fs.existsSync(recordingPath)) {
                            console.log('Starting diarization on:', recordingPath);
                            const segments = await pythonManager.runDiarization(recordingPath);
                            console.log('Diarization complete, segments:', segments.length);
                            this.processDiarizationResults(meetingId, segments);
                            this.broadcastStatus({ recording: false, processing: false, diarizationComplete: true });
                        } else {
                            console.error('Recording file not found:', recordingPath);
                            this.broadcastStatus({ recording: false, processing: false, error: 'Recording file missing' });
                        }
                        this.broadcastMeetingsUpdate();

                    } catch (e) {
                        console.error('Diarization failed / skipped:', e.message);
                        this.broadcastStatus({ recording: false, processing: false, error: 'Diarization failed' });
                    }
                })();
            }

            return { success: true };

        } catch (e) {
            console.error('Stop meeting error:', e);
            this.isRecording = false;
            return { success: false, error: e.message };
        }
    }

    handleTranscript(text) {
        if (!text || !this.currentMeetingId) return;

        // Approximate time
        const now = Date.now();
        const elapsedTime = (now - this.meetingStartTime) / 1000; // seconds
        const durationEstimate = 2.0;
        const startTime = Math.max(0, elapsedTime - durationEstimate);
        const endTime = elapsedTime;

        // Save to DB
        const db = dbModule.getDb();
        const stmt = db.prepare(`
        INSERT INTO transcripts (meeting_id, text, start_time, end_time)
        VALUES (?, ?, ?, ?)
    `);

        stmt.run(this.currentMeetingId, text, startTime, endTime);

        // Send to Renderer
        const mainWindow = require('electron').BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            mainWindow.webContents.send('transcript-update', {
                text,
                start: startTime,
                end: endTime,
                meetingId: this.currentMeetingId
            });
        }
    }

    processDiarizationResults(meetingId, segments) {
        const db = dbModule.getDb();
        // 1. Insert Speakers
        const speakers = [...new Set(segments.map(s => s.speaker))];
        const speakerMap = {}; // label -> id

        const insertSpeaker = db.prepare('INSERT INTO participants (meeting_id, name, speaker_label) VALUES (?, ?, ?)');

        speakers.forEach(label => {
            const info = insertSpeaker.run(meetingId, `Speaker ${label}`, label);
            speakerMap[label] = info.lastInsertRowid;
        });

        // 2. Update Transcripts with Speaker ID
        const transcripts = db.prepare('SELECT id, start_time, end_time FROM transcripts WHERE meeting_id = ?').all(meetingId);
        const updateTranscript = db.prepare('UPDATE transcripts SET speaker_id = ? WHERE id = ?');

        db.transaction(() => {
            transcripts.forEach(t => {
                const tCenter = (t.start_time + t.end_time) / 2;
                const match = segments.find(s => tCenter >= s.start && tCenter <= s.end);
                if (match) {
                    const speakerId = speakerMap[match.speaker];
                    if (speakerId) {
                        updateTranscript.run(speakerId, t.id);
                    }
                }
            });
        })();

        console.log('Updated transcripts with speakers.');
    }

    broadcastStatus(status) {
        const mainWindow = require('electron').BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            mainWindow.webContents.send('system-status', status);
        }
    }

    broadcastMeetingsUpdate() {
        const mainWindow = require('electron').BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            mainWindow.webContents.send('meetings-updated');
        }
    }
}

module.exports = new MeetingRecorder();
