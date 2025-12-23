const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    startMeeting: (data) => ipcRenderer.invoke('start-meeting', data),
    stopMeeting: () => ipcRenderer.invoke('stop-meeting'),
    receive: (channel, func) => {
        let validChannels = ['transcript-update', 'system-status', 'meetings-updated'];
        if (validChannels.includes(channel)) {
            // Remove listener to avoid duplicates if necessary, or just add
            // For simple use case, we just add. Cleanup is harder without sending back a unique ID.
            const subscription = (event, ...args) => func(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        }
    },
    invoke: (channel, data) => {
        let validChannels = [
            'start-meeting', 'stop-meeting',
            'update-transcript', 'update-speaker', 'get-participants',
            'get-meetings', 'get-transcripts', 'search-transcripts', 'export-meeting',
            'search-meetings'
        ];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
    },
    sendAudioData: (data) => ipcRenderer.send('audio-data', data)
});
