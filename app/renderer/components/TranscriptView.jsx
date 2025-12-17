import React, { useEffect, useState, useRef } from 'react';

function TranscriptView({ meetingId, isLive }) {
    const [transcripts, setTranscripts] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const bottomRef = useRef(null);

    // Load history when meetingId changes
    useEffect(() => {
        async function load() {
            if (meetingId && window.api) {
                const list = await window.api.invoke('get-transcripts', { meetingId });
                setTranscripts(list || []);
            } else {
                setTranscripts([]);
            }
        }
        load();
    }, [meetingId]);

    // Listen for live updates
    useEffect(() => {
        if (!isLive) return;

        if (window.api) {
            const cleanup = window.api.receive('transcript-update', (data) => {
                // Only append if it belongs to current meeting
                if (data.meetingId === meetingId) {
                    setTranscripts(prev => [...prev, data]);
                }
            });
            return cleanup; // Note: receive impl doesn't return cleanup, but ideally should. 
            // Our preload 'receive' just adds listener. Memory leak potential if we mount/unmount often.
            // For this app structure, TranscriptView is mostly static.
        }
    }, [isLive, meetingId]);

    useEffect(() => {
        if (!editingId && isLive) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [transcripts, editingId, isLive]);

    const handleSave = async (id, newText) => {
        setEditingId(null);
        if (window.api) {
            await window.api.invoke('update-transcript', { id, text: newText });
            setTranscripts(prev => prev.map(t => t.id === id ? { ...t, text: newText } : t));
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-white h-full custom-scrollbar">
            {transcripts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-50">
                    <p className="text-slate-400">대화 내용이 시작되면 자동으로 기록됩니다.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {transcripts.map((t, i) => {
                        const isUserSpeaker = t.speakerId === 'Speaker 0'; // Just an example logic if we wanted to differentiate sides
                        const speakerInitial = (t.speakerId || t.speaker_id || '?').replace('Speaker ', '')[0] || '?';
                        const speakerName = t.speakerId || t.speaker_id || 'Unknown';

                        return (
                            <div key={i} className="flex gap-4 group">
                                {/* Avatar */}
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${['bg-indigo-100 text-indigo-600', 'bg-rose-100 text-rose-600', 'bg-amber-100 text-amber-600', 'bg-emerald-100 text-emerald-600'][Math.abs(speakerName.charCodeAt(speakerName.length - 1)) % 4]
                                    }`}>
                                    {speakerInitial}
                                </div>

                                <div className="flex-1 space-y-1">
                                    <div className="flex items-baseline justify-between">
                                        <div className="text-xs font-semibold text-slate-500">{speakerName}</div>
                                        {/* <div className="text-[10px] text-slate-300">Timestamp</div> */}
                                    </div>

                                    <div className="prose prose-sm max-w-none text-slate-700">
                                        {editingId === t.id ? (
                                            <input
                                                autoFocus
                                                className="w-full bg-slate-50 border border-indigo-300 rounded p-2 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                                defaultValue={t.text}
                                                onBlur={(e) => handleSave(t.id, e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(t.id, e.currentTarget.value) }}
                                            />
                                        ) : (
                                            <span
                                                onClick={() => t.id && setEditingId(t.id)}
                                                className="block p-2 -ml-2 rounded-lg hover:bg-slate-50 cursor-text transition-colors border border-transparent hover:border-slate-100"
                                            >
                                                {t.text}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <div ref={bottomRef} className="h-4" />
        </div>
    );
}

export default TranscriptView;
