"""
TTS Inference Service — FastAPI
POST /synthesize  { "text": "..." }  → returns audio/wav stream
GET  /health      → { "status": "ok" }

Uses F5-TTS fine-tuned on Osho's voice.
Drop your trained checkpoint at: ../f5-training/checkpoints/model_last.pt
"""

import io
import os

os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
os.environ.pop("PYTHONHASHSEED", None)

import torch
import soundfile as sf
import numpy as np
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Osho TTS Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CKPT_DIR  = Path(__file__).parent.parent / "f5-training" / "checkpoints"
REFS_DIR  = Path(__file__).parent.parent / "voice-training" / "reference_clips"
REF_AUDIO = REFS_DIR / "ref_01.wav"

if torch.backends.mps.is_available():
    device = "mps"
elif torch.cuda.is_available():
    device = "cuda"
else:
    device = "cpu"

tts_pipe      = None  # fine-tuned
tts_pipe_base = None  # base (zero-shot)


def find_checkpoint() -> Path | None:
    candidates = sorted(CKPT_DIR.glob("**/*.pt"), key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0] if candidates else None


def load_model():
    global tts_pipe, tts_pipe_base
    from f5_tts.api import F5TTS

    ckpt = find_checkpoint()
    if ckpt:
        print(f"Loading fine-tuned checkpoint: {ckpt}")
        tts_pipe = F5TTS(ckpt_file=str(ckpt), device=device)
    else:
        print("No fine-tuned checkpoint found — loading base model only...")
        tts_pipe = F5TTS(device=device)

    print("Loading base F5-TTS model (zero-shot)...")
    tts_pipe_base = F5TTS(device=device)

    print(f"Both models loaded on {device}")


@app.on_event("startup")
async def startup():
    load_model()


class SynthRequest(BaseModel):
    text: str
    speed: float = 1.0


REF_TEXT = "It is the mind that has been trained into Aristotelian logic."


def _wav_response(wav, sr) -> StreamingResponse:
    if isinstance(wav, torch.Tensor):
        wav = wav.cpu().numpy()
    wav = np.array(wav, dtype=np.float32)
    buf = io.BytesIO()
    sf.write(buf, wav, samplerate=sr, format="WAV")
    buf.seek(0)
    return StreamingResponse(buf, media_type="audio/wav")


@app.get("/health")
def health():
    ckpt = find_checkpoint()
    return {
        "status": "ok",
        "device": device,
        "finetuned_loaded": tts_pipe is not None,
        "base_loaded": tts_pipe_base is not None,
        "checkpoint": str(ckpt) if ckpt else "base model",
    }


@app.post("/synthesize")
async def synthesize(req: SynthRequest):
    """Fine-tuned model — accent baked in from 19h of training."""
    if not tts_pipe:
        raise HTTPException(status_code=503, detail="Model not loaded")
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")
    if len(req.text) > 5000:
        raise HTTPException(status_code=400, detail="Text too long (max 5000 chars)")

    ref = str(REF_AUDIO) if REF_AUDIO.exists() else None
    try:
        wav, sr, _ = tts_pipe.infer(
            ref_file=ref, ref_text=REF_TEXT,
            gen_text=req.text, speed=req.speed, nfe_step=16,
        )
        return _wav_response(wav, sr)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/synthesize-zeroshot")
async def synthesize_zeroshot(req: SynthRequest):
    """Base model with ref clip only — no fine-tuning, accent inferred at runtime."""
    if not tts_pipe_base:
        raise HTTPException(status_code=503, detail="Base model not loaded")
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")
    if len(req.text) > 2000:
        raise HTTPException(status_code=400, detail="Text too long for zero-shot (max 2000 chars)")

    ref = str(REF_AUDIO) if REF_AUDIO.exists() else None
    try:
        wav, sr, _ = tts_pipe_base.infer(
            ref_file=ref, ref_text=REF_TEXT,
            gen_text=req.text, speed=req.speed, nfe_step=16,
        )
        return _wav_response(wav, sr)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
