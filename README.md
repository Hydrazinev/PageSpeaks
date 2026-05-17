# Osho Voice Clone

> Paste any text. Hear it in Osho's voice — fine-tuned AI, not a voice filter.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-osho--voice.vercel.app-black?style=for-the-badge&logo=vercel)](https://osho-voice.vercel.app)
[![Model](https://img.shields.io/badge/Model-HuggingFace-orange?style=for-the-badge&logo=huggingface)](https://huggingface.co/Hydrazinenv/osho-tts-model)
[![GPU](https://img.shields.io/badge/Inference-Modal%20T4%20GPU-purple?style=for-the-badge)](https://modal.com)

---

## The Problem

I wanted to hear Osho's voice read any text — not a robot voice, not a close approximation, but something that actually sounds like him: the Indian accent, the slow deliberate pauses, the way he stresses certain words.

**First attempt: zero-shot voice cloning.**
F5-TTS can clone a voice from a short reference clip at inference time — no training required. I fed it 10 seconds of Osho's audio as a reference and asked it to synthesize new text.

The result? *Close, but wrong.* The pitch and cadence were in the right ballpark. But the accent — the phoneme shapes, the vowel sounds, the stress patterns — those were completely off. It sounded like someone doing a rough impression, not the real thing.

**Why zero-shot fails at accent:**
A 10-second clip doesn't contain enough examples of every phoneme Osho produces. The model fills in the gaps with its training prior (mostly American/British English). Accent is deep — it's not just rhythm, it's how each individual sound is shaped, and that requires seeing hundreds of examples per sound across many different words and contexts.

**The fix: fine-tuning on 19 hours of real audio.**
Instead of asking the model to infer the accent at runtime, I trained it directly on Osho's voice — 6,676 clips covering thousands of unique words. After fine-tuning, the accent is baked into the model weights, not guessed from a clip.

---

## What I Built

A full end-to-end pipeline: raw MP3 lectures → processed dataset → fine-tuned model → serverless API → web app.

```
Raw MP3s (19 hours of Osho lectures)
         │
         ▼
 ┌─────────────────────┐
 │   Audio Pipeline    │  pydub · noisereduce · Whisper medium
 │   6,676 clips       │  silence-split → denoise → transcribe
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │   F5-TTS Dataset    │  mel spectrograms · duration.json
 │   Prep              │  pinyin tokenizer · 19.04h total
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │   Fine-tuning       │  F5TTS_v1_Base · Colab A100
 │   20 epochs         │  lr=5e-6 · batch=8 · flow-matching
 └──────────┬──────────┘
            │  5.4 GB checkpoint → Hugging Face Hub
            ▼
 ┌─────────────────────┐
 │   Modal FastAPI     │  Serverless T4 GPU · Volume cache
 │   /synthesize       │  nfe_step=32 · streams WAV chunks
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │   Next.js 15        │  Vercel · Tailwind · TypeScript
 │   Web App           │  chunk → fetch → play → prefetch
 └─────────────────────┘
```

---

## Engineering Decisions

### Zero-shot vs Fine-tuning
Zero-shot voice cloning is fast to set up but captures only surface-level voice characteristics. For accent — which lives in phoneme-level patterns learned over thousands of examples — fine-tuning is necessary. The 19-hour dataset gave the model enough coverage of Osho's phoneme inventory to reproduce his accent reliably.

### Why F5-TTS (flow-matching) over XTTS / Tortoise?
Flow-matching models converge faster and generalise better from single-speaker datasets. XTTS required more data for comparable quality; Tortoise was too slow for real-time inference. F5-TTS hit a good accent match by epoch 10.

### Audio pipeline design
Raw lecture recordings had background noise, applause, and inconsistent silence. The pipeline:
1. Splits on silence (min 400ms gap, -40dB threshold) to get natural sentence breaks
2. Merges short chunks up to 12 seconds (the model's sweet spot)
3. Denoises each clip with `noisereduce` using the first 300ms as a noise profile
4. Transcribes with Whisper `medium` — filters clips with fewer than 3 words

This produced 6,676 clean clips averaging ~10 seconds each.

### Why Modal for inference?
Serverless GPU means zero idle cost. The 5.4GB checkpoint downloads from Hugging Face Hub on first run and is cached in a Modal Volume — subsequent cold starts take ~30s instead of ~3min.

### Streaming playback
Rather than synthesizing the full text before playing, the frontend splits input into 800-character chunks at sentence boundaries and streams them sequentially. The user hears audio in ~3 seconds while the rest is being synthesized in the background.

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **Model** | F5-TTS (flow-matching) | Voice synthesis |
| **Training** | PyTorch · Accelerate · Colab A100 | Fine-tuning |
| **Audio prep** | Whisper · pydub · noisereduce | Dataset creation |
| **Backend** | FastAPI · Modal serverless GPU | Inference API |
| **Model storage** | Hugging Face Hub | Checkpoint hosting |
| **Frontend** | Next.js 15 · Tailwind · TypeScript | Web app |
| **Deployment** | Vercel + Modal | Zero-config hosting |

---

## Repo Structure

```
├── voice-training/
│   ├── 1_prepare_audio.py     # segment, denoise, transcribe 15h of MP3s
│   └── 3_prepare_new.py       # incrementally add new recordings
│
├── f5-training/
│   ├── prepare_dataset.py     # convert LJSpeech CSV → F5-TTS format
│   └── train.py               # fine-tuning entry point
│
├── tts-service/
│   ├── modal_app.py           # serverless GPU inference (production)
│   └── main.py                # local FastAPI server (development)
│
└── web/
    └── app/page.tsx           # streaming playback UI
```

---

## Run Locally

**Backend**
```bash
cd tts-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py          # → http://localhost:8000
```

**Frontend**
```bash
cd web
npm install
echo "NEXT_PUBLIC_TTS_URL=http://localhost:8000" > .env.local
npm run dev             # → http://localhost:3000
```

---

## Results

The fine-tuned model captures Osho's accent, cadence, and speech rhythm noticeably better than zero-shot. The biggest difference shows up in:
- **Vowel sounds** — his Indian English pronunciation of words like "being", "consciousness", "love"
- **Stress patterns** — where he places emphasis within a sentence
- **Pauses** — the deliberate silence before key words

Try the [live demo](https://osho-voice.vercel.app) — paste any quote or paragraph and compare it to the real recording on the site.
