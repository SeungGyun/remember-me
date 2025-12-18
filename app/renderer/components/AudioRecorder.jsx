import React, { useState, useEffect, useRef } from 'react';

// AudioWorklet processor code
const workletCode = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      this.port.postMessage(channelData);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

const AudioRecorder = ({ isRecording, onStop }) => {
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [elapsedTime, setElapsedTime] = useState(0);

    // Refs for audio processing
    const audioContextRef = useRef(null);
    const streamRef = useRef(null);
    const workletNodeRef = useRef(null);
    const sourceRef = useRef(null);
    const analyserRef = useRef(null);
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);

    // Ref to track recording state inside async data handlers
    const isRecordingRef = useRef(isRecording);

    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    // 1. Load Devices
    useEffect(() => {
        const getDevices = async () => {
            console.log("[AudioRecorder] Requesting microphone access...");
            try {
                // Request permission first to get labels
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log("[AudioRecorder] Microphone access granted:", stream.id);

                // Stop the stream immediately
                stream.getTracks().forEach(t => t.stop());

                const devs = await navigator.mediaDevices.enumerateDevices();
                console.log("[AudioRecorder] enumerateDevices result:", devs);

                const audioInputDevs = devs.filter(d => d.kind === 'audioinput');
                console.log("[AudioRecorder] Found audio input devices:", audioInputDevs);

                setDevices(audioInputDevs);
                if (audioInputDevs.length > 0 && !selectedDeviceId) {
                    setSelectedDeviceId(audioInputDevs[0].deviceId);
                } else if (audioInputDevs.length === 0) {
                    console.warn("[AudioRecorder] No audio input devices found.");
                    alert("마이크 장치를 찾을 수 없습니다. 윈도우 설정 > 개인정보 > 마이크 권한을 확인해주세요.");
                }
            } catch (err) {
                console.error('[AudioRecorder] Error accessing devices:', err);
                console.error('[AudioRecorder] Error Name:', err.name);
                console.error('[AudioRecorder] Error Message:', err.message);
                alert(`마이크 접근 오류: ${err.name} - ${err.message}`);
            }
        };

        getDevices();
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, []);

    // 2. Timer
    useEffect(() => {
        let interval;
        if (isRecording) {
            const startTime = Date.now() - (elapsedTime * 1000);
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } else {
            clearInterval(interval);
            setElapsedTime(0);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    // 3. Audio Processing & Visualizer
    useEffect(() => {
        if (isRecording && selectedDeviceId) {
            startAudio();
        } else {
            stopAudio();
        }
        return () => stopAudio();
    }, [isRecording, selectedDeviceId]);

    const startAudio = async () => {
        if (!selectedDeviceId) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: { exact: selectedDeviceId },
                    channelCount: 1,
                    sampleRate: 16000
                }
            });

            streamRef.current = stream;
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            const ctx = audioContextRef.current;

            sourceRef.current = ctx.createMediaStreamSource(stream);
            analyserRef.current = ctx.createAnalyser();
            analyserRef.current.fftSize = 256;

            // Create AudioWorklet from blob
            const blob = new Blob([workletCode], { type: 'application/javascript' });
            const workletUrl = URL.createObjectURL(blob);
            await ctx.audioWorklet.addModule(workletUrl);

            const workletNode = new AudioWorkletNode(ctx, 'pcm-processor');
            workletNodeRef.current = workletNode;

            workletNode.port.onmessage = (event) => {
                if (!isRecordingRef.current) return;

                try {
                    const inputData = event.data; // Float32Array
                    const length = inputData.length;

                    // Convert Float32 to Int16
                    const int16Data = new Int16Array(length);
                    for (let i = 0; i < length; i++) {
                        const s = Math.max(-1, Math.min(1, inputData[i]));
                        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }

                    // Send via IPC
                    if (window.api && window.api.sendAudioData) {
                        window.api.sendAudioData(int16Data);
                    }
                } catch (err) {
                    console.error("[AudioRecorder] Processing error:", err);
                }
            };

            sourceRef.current.connect(analyserRef.current);
            analyserRef.current.connect(workletNode);
            workletNode.connect(ctx.destination);

            // Temporarily disable visualizer for stability check
            // drawVisualizer(); 

        } catch (err) {
            console.error('Failed to start audio:', err);
            alert(`오디오 시작 실패: ${err.message}`);
        }
    };

    const stopAudio = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (workletNodeRef.current) {
            workletNodeRef.current.disconnect();
            workletNodeRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };

    const drawVisualizer = () => {
        if (!analyserRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyserRef.current.getByteFrequencyData(dataArray);

            ctx.fillStyle = 'rgb(248, 250, 252)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                ctx.fillStyle = `rgb(99, 102, 241)`;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        draw();
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (!isRecording) {
        return (
            <div className="flex items-center gap-3">
                <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="max-w-[150px] text-xs py-1.5 pl-2 pr-6 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600 shadow-sm"
                >
                    {devices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                        </option>
                    ))}
                </select>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-indigo-100 shadow-sm animate-fade-in">
            {/* Timer */}
            <div className="flex items-center gap-2 font-mono text-indigo-600 font-bold min-w-[80px]">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                {formatTime(elapsedTime)}
            </div>

            {/* Visualizer */}
            <canvas
                ref={canvasRef}
                width={120}
                height={30}
                className="rounded opacity-80"
            />

            {/* Stop Button */}
            <button
                onClick={onStop}
                className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                title="기록 중지"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};

export default AudioRecorder;
