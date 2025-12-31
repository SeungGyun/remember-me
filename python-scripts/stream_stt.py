import sys
import json
import numpy as np
import io
import torch
import whisper
import time

def log_to_file(msg):
    try:
        with open("python_runtime.log", "a", encoding="utf-8") as f:
            f.write(f"{time.time()}: {msg}\n")
    except: pass

def main():
    # Force UTF-8 for stdout/stderr to fix Mojibake (占쏙옙...)
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        except: pass

    log_to_file("Script started")

    # Check for GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"
    log_to_file(f"Loading Whisper model on {device}...")
    
    try:
        # Use 'base' for faster CPU inference
        model = whisper.load_model("base", device=device) 
    except Exception as e:
        log_to_file(f"Failed to load model: {e}")
        sys.exit(1)

    log_to_file("Model loaded. Ready for audio.")

    # Audio verification parameters
    SAMPLE_RATE = 16000
    CHANNELS = 1
    BYTES_PER_SAMPLE = 2 
    
    # Process 3.0 seconds
    CHUNK_DURATION = 3.0 
    CHUNK_BYTES = int(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * CHUNK_DURATION)
    
    # Overlap: keep last 1.0 second
    OVERLAP_DURATION = 1.0
    OVERLAP_BYTES = int(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * OVERLAP_DURATION)
    
    audio_buffer = bytearray()
    
    log_to_file(f"Chunk size: {CHUNK_BYTES} bytes, Overlap: {OVERLAP_BYTES} bytes")

    # Debug: Open file to dump input audio
    try:
        debug_file = open("debug_input.raw", "wb")
    except Exception as e:
        log_to_file(f"Failed to open debug file: {e}")

    loop_count = 0
    while True:
        try:
            # Read smaller chunks from stdin
            chunk = sys.stdin.buffer.read(4096)
            if not chunk:
                break
            
            # Write to debug file
            try:
                debug_file.write(chunk)
                debug_file.flush()
            except: pass

            audio_buffer.extend(chunk)
            
            # log every 10 chunks to avoid spam but verify life
            loop_count += 1
            if loop_count % 20 == 0:
                log_to_file(f"Buffer size: {len(audio_buffer)} / {CHUNK_BYTES}")

            # Process when we have enough data
            if len(audio_buffer) >= CHUNK_BYTES:
                log_to_file("Starting transcription...")
                
                # Take exactly CHUNK_BYTES
                process_data = audio_buffer[:CHUNK_BYTES]
                
                # Convert int16 -> float32
                audio_np = np.frombuffer(process_data, dtype=np.int16).flatten().astype(np.float32) / 32768.0
                
                # Transcribe
                start_time = time.time()
                try:
                    result = model.transcribe(
                        audio_np, 
                        language="ko", 
                        fp16=False,
                        condition_on_previous_text=False,
                        no_speech_threshold=0.6, 
                        logprob_threshold=-1.0
                    )
                    inference_time = time.time() - start_time
                    text = result['text'].strip()
                    
                    log_to_file(f"Inference took {inference_time:.2f}s | Text: '{text}'")

                    if text:
                        output = {"text": text, "raw_acc": 0.0}
                        print(json.dumps(output, ensure_ascii=False), flush=True)

                except Exception as e:
                    log_to_file(f"Transcribe Error: {e}")

                # Sliding window
                step_size = CHUNK_BYTES - OVERLAP_BYTES
                audio_buffer = audio_buffer[step_size:]
                log_to_file(f"Buffer sliced. New size: {len(audio_buffer)}")
                
        except KeyboardInterrupt:
            break
        except Exception as e:
            log_to_file(f"Error: {e}")
            break

if __name__ == "__main__":
    main()
