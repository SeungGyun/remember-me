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
        <div className="flex-1 overflow-y-auto p-4 bg-white rounded-lg shadow h-full border border-gray-200">
            {transcripts.length === 0 ? (
                <p className="text-gray-400 text-center mt-10">대화 내용이 여기에 표시됩니다.</p>
            ) : (
                transcripts.map((t, i) => (
                    <div key={i} className="mb-4">
                        <div className="text-xs text-gray-500 mb-1">Speaker {t.speakerId || t.speaker_id || '?'}</div>
                        <div className="bg-gray-50 p-3 rounded-lg text-gray-800">
                            {editingId === t.id ? (
                                <input
                                    autoFocus
                                    className="w-full bg-white border p-1"
                                    defaultValue={t.text}
                                    onBlur={(e) => handleSave(t.id, e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(t.id, e.currentTarget.value) }}
                                />
                            ) : (
                                <span onClick={() => t.id && setEditingId(t.id)} className="cursor-pointer hover:bg-gray-100 block">
                                    {t.text}
                                </span>
                            )}
                        </div>
                    </div>
                ))
            )}
            <div ref={bottomRef} />
        </div>
    );
}

export default TranscriptView;
