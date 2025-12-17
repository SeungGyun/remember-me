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
        <div className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto hidden md:block">
            <div className="p-4 border-b">
                <h2 className="font-bold text-gray-700">회의 기록</h2>
            </div>
            <ul>
                {meetings.map(m => (
                    <li
                        key={m.id}
                        onClick={() => onSelectMeeting(m.id)}
                        className={`p-3 border-b cursor-pointer hover:bg-blue-50 ${currentMeetingId === m.id ? 'bg-blue-100' : ''}`}
                    >
                        <div className="font-medium text-sm truncate">{m.title}</div>
                        <div className="text-xs text-gray-500">{m.start_time}</div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default MeetingList;
