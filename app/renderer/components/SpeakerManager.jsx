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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Card */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800">화자 관리</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-4">
                        {speakers.map((s, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors shadow-sm">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                                    {(s.name || s.speaker_label)[0]}
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs text-slate-400 mb-1">{s.speaker_label}</div>
                                    <input
                                        type="text"
                                        defaultValue={s.name}
                                        onBlur={(e) => handleRename(s.speaker_label, e.target.value)}
                                        className="w-full text-sm font-medium text-slate-800 border-none p-0 focus:ring-0 placeholder-slate-300"
                                        placeholder="이름 입력..."
                                    />
                                </div>
                            </div>
                        ))}
                        {speakers.length === 0 && (
                            <div className="text-center py-8">
                                <div className="text-4xl mb-2">👥</div>
                                <p className="text-slate-500 font-medium">화자 정보가 아직 없습니다.</p>
                                <p className="text-slate-400 text-sm">회의가 진행되면 화자가 자동으로 감지됩니다.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SpeakerManager;
