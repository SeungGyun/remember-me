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
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">
            <MeetingList
                onSelectMeeting={(id) => {
                    if (isRecording) {
                        // Use a toast in future, for now alert is fine but let's try to be less intrusive if possible
                        alert('녹음 중에는 다른 회의를 볼 수 없습니다.');
                        return;
                    }
                    setCurrentMeetingId(id);
                }}
                currentMeetingId={currentMeetingId}
            />

            <div className="flex-1 flex flex-col relative min-w-0">
                {/* Glass Header */}
                <header className="z-10 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/80 backdrop-blur-md border-b border-indigo-100/50 sticky top-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white font-bold text-lg">
                            R
                        </div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">
                            Remember Me
                        </h1>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="relative group w-full md:w-64 transition-all">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="검색..."
                                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="h-6 w-px bg-slate-200 hidden md:block mx-1"></div>

                        {!isRecording ? (
                            <div className="flex gap-2 w-full md:w-auto">
                                <input
                                    type="text"
                                    placeholder="새 회의 제목..."
                                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm flex-1 md:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                                    value={meetingTitle}
                                    onChange={(e) => setMeetingTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') startMeeting();
                                    }}
                                />
                                <button
                                    onClick={startMeeting}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 active:scale-95 transition-all whitespace-nowrap"
                                >
                                    + 회의 시작
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={stopMeeting}
                                className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 active:scale-95 transition-all animate-pulse whitespace-nowrap w-full md:w-auto flex items-center justify-center gap-2"
                            >
                                <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
                                기록 중지
                            </button>
                        )}

                        {currentMeetingId && (
                            <div className="flex gap-2 w-full md:w-auto justify-end md:ml-auto">
                                <button
                                    onClick={() => setShowSpeakerManager(true)}
                                    className="px-3 py-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm transition-colors flex items-center gap-1.5 font-medium"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    화자
                                </button>
                                <button
                                    onClick={handleExport}
                                    className="px-3 py-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm transition-colors flex items-center gap-1.5 font-medium"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    내보내기
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-hidden p-6 relative">
                    {currentMeetingId ? (
                        <div className="h-full max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <TranscriptView
                                meetingId={currentMeetingId}
                                isLive={isRecording}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                            </div>
                            <p className="text-lg font-medium">새로운 회의를 시작하거나 목록에서 선택하세요</p>
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
