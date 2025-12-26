import sys
import json
import numpy as np
import io
import torch
import whisper
import time

def main():
    # Debug logging to file
    with open("python_debug_start.log", "w") as f:
        f.write("Python script started\n")

    # Force stdin/stdout to binary or unbuffered where appropriate?
    # Actually for stdout we want text (JSON), but unbuffered.
    # Stdin is binary audio.
    
    # Check for GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"
    sys.stderr.write(f"Loading Whisper model on {device}...\n")
    sys.stderr.flush()
    
    try:
        # Use 'base' for faster CPU inference
        model = whisper.load_model("base", device=device) 
    except Exception as e:
        sys.stderr.write(f"Failed to load model: {e}\n")
        sys.exit(1)

    sys.stderr.write("Model loaded. Ready for audio.\n")
    sys.stderr.flush()

    # Audio verification parameters
    SAMPLE_RATE = 16000
    CHANNELS = 1
    # 2 bytes per sample (int16)
    BYTES_PER_SAMPLE = 2 
    
    # We want to process roughly 2.0 seconds of audio at a time for faster feedback
    CHUNK_DURATION = 2.0 # seconds
    CHUNK_SIZE = int(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * CHUNK_DURATION)
    
    audio_buffer = bytearray()
    
    sys.stderr.write(f"Chunk size: {CHUNK_SIZE} bytes ({CHUNK_DURATION}s)\n")

    while True:
        try:
            # Read chunk
            # We read smaller chunks to be responsive, but accumulate
            chunk = sys.stdin.buffer.read(4096)
            if not chunk:
                break
            
            audio_buffer.extend(chunk)
            
            # If we have enough data, process it
            if len(audio_buffer) >= CHUNK_SIZE:
                # Convert buffer to numpy array
                # whisper expects float32 array, normalized to [-1, 1]
                
                # Take the chunk
                process_data = audio_buffer[:CHUNK_SIZE]
                
                # Convert int16 -> float32
                audio_np = np.frombuffer(process_data, dtype=np.int16).flatten().astype(np.float32) / 32768.0
                
                # Transcribe
                start_time = time.time()
                result = model.transcribe(audio_np, language="ko", fp16=False) # fp16=False mostly for CPU safety
                inference_time = time.time() - start_time
                text = result['text'].strip()
                
                sys.stderr.write(f"Inference took {inference_time:.2f}s | Text: '{text}'\n")

                if text:
                    output = {
                        "text": text,
                        "raw_acc": 0.0 # placeholder
                    }
                    print(json.dumps(output), flush=True)
                
                # Reset buffer
                # Optional: Overlay strategy
                # Keep last 0.5 seconds to avoid cutting words
                OVERLAP_BYTES = SAMPLE_RATE * BYTES_PER_SAMPLE * 0.5 # 0.5s
                overlap_len = int(OVERLAP_BYTES)
                audio_buffer = audio_buffer[CHUNK_SIZE - overlap_len:]
                
        except KeyboardInterrupt:
            break
        except Exception as e:
            sys.stderr.write(f"Error: {e}\n")
            break

if __name__ == "__main__":
    main()
