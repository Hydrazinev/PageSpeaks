import os
import io
import modal
import torch
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

MODEL_REPO = "Hydrazinenv/osho-tts-model"
REF_TEXT   = "It is the mind that has been trained into Aristotelian logic."

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(["ffmpeg"])
    .pip_install(["f5-tts", "soundfile", "numpy", "huggingface_hub", "fastapi"])
)

volume = modal.Volume.from_name("osho-model-cache", create_if_missing=True)

app = modal.App("osho-tts")


@app.cls(
    gpu="T4",
    image=image,
    volumes={"/models": volume},
    scaledown_window=300,
    timeout=120,
)
class OshoTTS:
    @modal.enter()
    def load(self):
        os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
        from pathlib import Path
        from huggingface_hub import hf_hub_download
        from f5_tts.api import F5TTS
        import shutil

        ckpt_path = Path("/models/model_last.pt")
        ref_path  = Path("/models/ref_01.wav")

        if not ckpt_path.exists():
            print("Downloading checkpoint from HF Hub...")
            src = hf_hub_download(MODEL_REPO, "model_last.pt")
            shutil.copy(src, ckpt_path)
            volume.commit()

        if not ref_path.exists():
            src = hf_hub_download(MODEL_REPO, "ref_01.wav")
            shutil.copy(src, ref_path)
            volume.commit()

        print("Loading fine-tuned F5-TTS model...")
        self.tts_finetuned = F5TTS(ckpt_file=str(ckpt_path), device="cuda")

        print("Loading base F5-TTS model (zero-shot)...")
        self.tts_base = F5TTS(device="cuda")  # base model, no custom checkpoint

        self.ref = str(ref_path)
        print("Both models ready!")

    @modal.asgi_app()
    def web(self):
        fastapi_app = FastAPI(title="Osho TTS")
        fastapi_app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )

        tts_finetuned = self.tts_finetuned
        tts_base      = self.tts_base
        ref           = self.ref

        class SynthRequest(BaseModel):
            text: str
            speed: float = 1.0

        def _wav_to_response(wav, sr) -> StreamingResponse:
            if isinstance(wav, torch.Tensor):
                wav = wav.cpu().numpy()
            wav = np.array(wav, dtype=np.float32)
            buf = io.BytesIO()
            sf.write(buf, wav, samplerate=sr, format="WAV")
            buf.seek(0)
            return StreamingResponse(buf, media_type="audio/wav")

        @fastapi_app.get("/health")
        def health():
            return {"status": "ok"}

        @fastapi_app.post("/synthesize")
        async def synthesize(req: SynthRequest):
            """Fine-tuned model — accent baked in from 19h of training."""
            if not req.text.strip():
                raise HTTPException(400, "Text is empty")
            if len(req.text) > 5000:
                raise HTTPException(400, "Text too long (max 5000 chars)")

            wav, sr, _ = tts_finetuned.infer(
                ref_file=ref,
                ref_text=REF_TEXT,
                gen_text=req.text,
                speed=req.speed,
                nfe_step=32,
            )
            return _wav_to_response(wav, sr)

        @fastapi_app.post("/synthesize-zeroshot")
        async def synthesize_zeroshot(req: SynthRequest):
            """Base model with ref clip only — no fine-tuning, accent inferred at runtime."""
            if not req.text.strip():
                raise HTTPException(400, "Text is empty")
            if len(req.text) > 2000:
                raise HTTPException(400, "Text too long for zero-shot (max 2000 chars)")

            wav, sr, _ = tts_base.infer(
                ref_file=ref,
                ref_text=REF_TEXT,
                gen_text=req.text,
                speed=req.speed,
                nfe_step=32,
            )
            return _wav_to_response(wav, sr)

        return fastapi_app
