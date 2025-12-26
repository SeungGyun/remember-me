import whisper
import sys
import os

# Add local FFmpeg to PATH so whisper can find it
ffmpeg_dir = r"c:\git\ilhsk_naver\remember-me\dist\win-unpacked\resources\ffmpeg\bin"
os.environ["PATH"] += os.pathsep + ffmpeg_dir

try:
    print("Loading model...")
    model = whisper.load_model("base", device="cpu")
    
    file_path = r"C:\Users\ilhsk\AppData\Roaming\remember-me\recordings\meeting-1766722212057.wav"
    print(f"Transcribing: {file_path}")
    
    result = model.transcribe(file_path, language="ko", fp16=False)
    print("--- TRANSCRIPT START ---")
    print(result['text'])
    print("--- TRANSCRIPT END ---")
except Exception as e:
    print(f"Error: {e}")
