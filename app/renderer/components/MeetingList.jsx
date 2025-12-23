import React, { useEffect, useState } from 'react';

function MeetingList({ onSelectMeeting, currentMeetingId, isRecording }) {
    const [meetings, setMeetings] = useState([]);
    const [playingId, setPlayingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const audioRef = React.useRef(new Audio());

    useEffect(() => {
        loadMeetings();
        const interval = setInterval(loadMeetings, 10000);
        if (window.api) {
            window.api.receive('meetings-updated', () => loadMeetings());
        }
        return () => {
            clearInterval(interval);
            audioRef.current.pause();
        };
    }, [searchQuery]);

    const loadMeetings = async () => {
        if (window.api) {
            let list;
            if (searchQuery.trim()) {
                list = await window.api.invoke('search-meetings', { query: searchQuery });
            } else {
                list = await window.api.invoke('get-meetings');
            }
            setMeetings(list || []);
        }
    };

    const handlePlay = (e, meeting) => {
        e.stopPropagation();

        if (isRecording) {
            alert('녹음 중에는 재생할 수 없습니다.');
            return;
        }

        if (playingId === meeting.id) {
            audioRef.current.pause();
            setPlayingId(null);
            return;
        }

        if (meeting.audio_path) {
            // Normalize path for Windows
            const normalizedPath = meeting.audio_path.replace(/\\/g, '/');
            audioRef.current.src = `file:///${normalizedPath}`;

            audioRef.current.play().catch(err => {
                console.error("Playback failed:", err);
                // alert(`오디오 재생 실패: ${err.message}`); // Only for debug
                alert("오디오 파일을 재생할 수 없습니다. (파일이 없거나 손상됨)");
            });
            setPlayingId(meeting.id);

            audioRef.current.onended = () => setPlayingId(null);
        } else {
            alert('오디오 파일이 없습니다.');
        }
    };

    return (
        <div className="w-72 bg-white h-full overflow-y-auto hidden md:flex flex-col border-r border-slate-200 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-20">
            <div className="p-6">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Past Meetings</h2>

                <div className="relative mb-4">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="검색 (제목, 내용, 날짜)"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    {meetings.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">기록이 없습니다.</p>
                    ) : (
                        <ul>
                            {meetings.map(m => (
                                <li
                                    key={m.id}
                                    onClick={() => onSelectMeeting(m.id)}
                                    className={`group p-3 rounded-xl cursor-pointer transition-all mb-2 border ${currentMeetingId === m.id
                                        ? 'bg-indigo-50 border-indigo-100 shadow-sm'
                                        : 'border-transparent hover:bg-slate-50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div className={`font-medium text-sm mb-1 line-clamp-1 ${currentMeetingId === m.id ? 'text-indigo-900' : 'text-slate-700 group-hover:text-slate-900'}`}>
                                            {m.title}
                                        </div>
                                        {m.audio_path && (
                                            <button
                                                onClick={(e) => handlePlay(e, m)}
                                                className={`p-1 rounded-full hover:bg-indigo-100 transition-colors ${playingId === m.id ? 'text-indigo-600' : 'text-slate-400'}`}
                                            >
                                                {playingId === m.id ? (
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {m.start_time}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MeetingList;
