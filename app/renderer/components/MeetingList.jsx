import React, { useEffect, useState } from 'react';

function MeetingList({ onSelectMeeting, currentMeetingId }) {
    const [meetings, setMeetings] = useState([]);

    useEffect(() => {
        loadMeetings();
        // Poll for updates (fallback)
        const interval = setInterval(loadMeetings, 10000);

        // Listen for events
        if (window.api) {
            window.api.receive('meetings-updated', loadMeetings);
        }

        return () => clearInterval(interval);
    }, []);

    const loadMeetings = async () => {
        if (window.api) {
            const list = await window.api.invoke('get-meetings');
            setMeetings(list || []);
        }
    };

    return (
        <div className="w-72 bg-white h-full overflow-y-auto hidden md:flex flex-col border-r border-slate-200 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-20">
            <div className="p-6">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Past Meetings</h2>
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
                                    <div className={`font-medium text-sm mb-1 line-clamp-1 ${currentMeetingId === m.id ? 'text-indigo-900' : 'text-slate-700 group-hover:text-slate-900'}`}>
                                        {m.title}
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
