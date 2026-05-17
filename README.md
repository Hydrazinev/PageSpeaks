# 🎙️ Osho Voice Clone

> Fine-tuned F5-TTS on 19 hours of Osho's speeches. Paste any text — hear it in his voice.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-osho--voice.vercel.app-black?style=for-the-badge&logo=vercel)](https://osho-voice.vercel.app)
[![Model](https://img.shields.io/badge/Model-HuggingFace-orange?style=for-the-badge&logo=huggingface)](https://huggingface.co/Hydrazinenv/osho-tts-model)
[![GPU](https://img.shields.io/badge/Inference-Modal%20T4%20GPU-purple?style=for-the-badge)](https://modal.com)

---

## ✨ Features

- 🗣️ **Custom voice clone** — F5-TTS fine-tuned on 19h of real audio, not a generic TTS
- ⚡ **Streaming playback** — audio starts playing before the full text is synthesized
- 📖 **Book-length input** — handles unlimited text via sentence-boundary chunking
- ⏸️ **Full playback controls** — play, pause, resume, stop + speed slider
- 🌐 **Fully deployed** — Vercel frontend + Modal serverless GPU backend, zero idle cost

---

## 🏗️ Architecture

```
Raw MP3s (19 hours of lectures)
         │
         ▼
 ┌───────────────────┐
 │  Audio Pipeline   │  pydub · noisereduce · Whisper medium
 │  6,676 clips      │  silence-split → denoise → transcribe
 └────────┬──────────┘
          │
          ▼
 ┌───────────────────┐
 │  F5-TTS Dataset   │  mel spectrograms · duration.json
 │  Prep             │  pinyin tokenizer · 19.04h total
 └────────┬──────────┘
          │
          ▼
 ┌───────────────────┐
 │  Fine-tuning      │  F5TTS_v1_Base · Colab A100
 │  20 epochs        │  lr=5e-6 · batch=8 · flow-matching
 └────────┬──────────┘
          │  5.4 GB checkpoint → Hugging Face Hub
          ▼
 ┌───────────────────┐
 │  Modal FastAPI    │  Serverless T4 GPU · Volume cache
 │  /synthesize      │  nfe_step=32 · streams WAV
 └────────┬──────────┘
          │
          ▼
 ┌───────────────────┐
 │  Next.js 15       │  Vercel · Tailwind · TypeScript
 │  Web App          │  chunk → fetch → play → prefetch
 └───────────────────┘
```

---

## 🛠️ Tech Stack

| | Technology | Purpose |
|---|---|---|
| **Model** | F5-TTS (flow-matching) | Voice synthesis |
| **Training** | PyTorch · Accelerate · Colab A100 | Fine-tuning |
| **Audio prep** | Whisper · pydub · noisereduce | Dataset creation |
| **Backend** | FastAPI · Modal serverless GPU | Inference API |
| **Model storage** | Hugging Face Hub | Checkpoint hosting |
| **Frontend** | Next.js 15 · Tailwind · TypeScript | Web app |
| **Deployment** | Vercel + Modal | Zero-config hosting |

---

## 📂 Repo Structure

```
├── voice-training/
│   ├── 1_prepare_audio.py     # segment, denoise, transcribe ~15h of MP3s
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

## 🚀 Run Locally

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

## 💡 Key Engineering Decisions

**Why F5-TTS over XTTS/Tortoise?**
Flow-matching produces more natural prosody with less training data. F5-TTS converges faster and generalises better from a single speaker dataset.

**Why Modal for inference?**
Serverless GPU means zero cost at idle — the T4 spins up per request and the 5.4GB checkpoint is cached in a Modal Volume so cold starts after the first load are fast (~30s vs ~3min).

**Why chunk + stream instead of full synthesis?**
Processing 800-char chunks in parallel with playback makes long texts feel instant. The user hears audio in ~3s instead of waiting minutes for a full book chapter.
