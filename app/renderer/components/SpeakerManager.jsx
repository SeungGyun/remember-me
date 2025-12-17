import React, { useState, useEffect } from 'react';

function SpeakerManager({ meetingId, isOpen, onClose }) {
    const [speakers, setSpeakers] = useState([]);

    useEffect(() => {
        if (isOpen && meetingId) {
            loadSpeakers();
        }
    }, [isOpen, meetingId]);

    const loadSpeakers = async () => {
        if (window.api) {
            const list = await window.api.invoke('get-participants', { meetingId });
            setSpeakers(list || []);
        }
    };

    const handleRename = async (label, newName) => {
        if (window.api) {
            await window.api.invoke('update-speaker', { meetingId, label, name: newName });
            loadSpeakers();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                <h2 className="text-xl font-bold mb-4">화자 관리</h2>
                <div className="space-y-4">
                    {speakers.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="w-24 text-sm text-gray-500">{s.speaker_label}</span>
                            <input
                                type="text"
                                defaultValue={s.name}
                                onBlur={(e) => handleRename(s.speaker_label, e.target.value)}
                                className="flex-1 border p-1 rounded"
                            />
                        </div>
                    ))}
                    {speakers.length === 0 && <p className="text-gray-400">화자 정보가 없습니다.</p>}
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">닫기</button>
                </div>
            </div>
        </div>
    );
}

export default SpeakerManager;
