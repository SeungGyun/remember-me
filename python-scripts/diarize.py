import sys
import json
import os
import torch
from pyannote.audio import Pipeline

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input file provided"}))
        return

    wav_path = sys.argv[1]
    
    if not os.path.exists(wav_path):
        print(json.dumps({"error": "File not found"}))
        return

    # Auth token should be provided via env var or config
    # For now, we assume HF_TOKEN is set or model is offline
    auth_token = os.environ.get("HF_TOKEN")
    
    try:
        # Load pipeline
        # Note: 'pyannote/speaker-diarization-3.1' requires acceptance of user conditions on HF
        # If running completely offline, the model files must be cached or local path provided.
        # Here we attempt standard load.
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=auth_token
        )
        
        if pipeline is None:
             print(json.dumps({"error": "Failed to load pipeline (Check HF_TOKEN)"}))
             return

        # Run on cpu
        pipeline.to(torch.device("cpu"))

        # Apply
        diarization = pipeline(wav_path)

        # Serialize
        result = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            result.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker
            })

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
