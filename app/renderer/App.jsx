import React, { useState, useEffect } from 'react';
import TranscriptView from './components/TranscriptView';
import SpeakerManager from './components/SpeakerManager';
import MeetingList from './components/MeetingList';

function App() {
    const [isRecording, setIsRecording] = useState(false);
    const [meetingTitle, setMeetingTitle] = useState('');
    const [currentMeetingId, setCurrentMeetingId] = useState(null);
    const [showSpeakerManager, setShowSpeakerManager] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (window.api) {
            window.api.receive('system-status', (status) => {
                if (status.meetingId) setCurrentMeetingId(status.meetingId);
                if (status.recording !== undefined) setIsRecording(status.recording);
            });
        }
    }, []);

    const startMeeting = async () => {
        if (!meetingTitle) return alert('회의 제목을 입력해주세요');
        if (window.api) {
            const res = await window.api.invoke('start-meeting', { title: meetingTitle, room: 'Default Room' });
            if (res.success) {
                setIsRecording(true);
                setCurrentMeetingId(res.meetingId);
            }
        }
    };

    const stopMeeting = async () => {
        if (window.api) {
            await window.api.invoke('stop-meeting');
            setIsRecording(false);
        }
    };

    const handleExport = async () => {
        if (!currentMeetingId) return;
        if (window.api) {
            const res = await window.api.invoke('export-meeting', { meetingId: currentMeetingId });
            if (res.success) alert(`저장되었습니다: ${res.filePath}`);
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            <MeetingList
                onSelectMeeting={(id) => {
                    if (isRecording) {
                        alert('녹음 중에는 다른 회의를 볼 수 없습니다.');
                        return;
                    }
                    setCurrentMeetingId(id);
                }}
                currentMeetingId={currentMeetingId}
            />

            <div className="flex-1 flex flex-col p-4">
                <header className="mb-4 flex justify-between items-center bg-white p-4 rounded shadow-sm">
                    <h1 className="text-2xl font-bold text-blue-600">Remember Me</h1>

                    <div className="flex items-center gap-4">
                        <input
                            type="text"
                            placeholder="검색..."
                            className="px-3 py-1 border rounded text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        // Search impl: could filter local transcript or IPC search
                        />

                        {!isRecording ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="새 회의 제목"
                                    className="px-3 py-2 border rounded"
                                    value={meetingTitle}
                                    onChange={(e) => setMeetingTitle(e.target.value)}
                                />
                                <button
                                    onClick={startMeeting}
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                >
                                    시작
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={stopMeeting}
                                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 animate-pulse"
                            >
                                ■ 중지
                            </button>
                        )}

                        {currentMeetingId && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowSpeakerManager(true)}
                                    className="bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 text-sm"
                                >
                                    화자 관리
                                </button>
                                <button
                                    onClick={handleExport}
                                    className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm"
                                >
                                    내보내기
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-hidden">
                    {currentMeetingId ? (
                        <TranscriptView
                            meetingId={currentMeetingId}
                            isLive={isRecording}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            회의를 선택하거나 시작하세요.
                        </div>
                    )}
                </main>

                <SpeakerManager
                    isOpen={showSpeakerManager}
                    onClose={() => setShowSpeakerManager(false)}
                    meetingId={currentMeetingId}
                />
            </div>
        </div>
    );
}

export default App;
