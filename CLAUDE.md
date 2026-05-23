# Osho Voice Clone — Project Context

> Fine-tuned F5-TTS voice clone of Osho. Paste text → hear it in his voice.

**Live site:** https://osho-voice.vercel.app  
**Modal backend:** https://hydrazinev--osho-tts-oshotts-web.modal.run  
**HuggingFace model:** `Hydrazinenv/osho-tts-model` (files: `model_last.pt` + `ref_01.wav`)  
**GitHub:** https://github.com/Hydrazinev/osho-voice

---

## Architecture

```
User types text
    │
    ▼
Next.js 16 (Vercel)          ← web/app/page.tsx
    │  POST /synthesize
    │  {text, speed} → WAV
    ▼
FastAPI on Modal T4 GPU      ← tts-service/modal_app.py
    │  F5-TTS infer()
    │  checkpoint from HF Hub, cached in Modal Volume
    ▼
audio/wav stream back → chunked playback in browser
```

---

## Repo Structure

```
Osho voice/
├── Osho Rec/                    ← raw MP3 lectures (gitignored, 19h total)
│
├── voice-training/
│   ├── 1_prepare_audio.py       ← STEP 1: MP3 → WAV, silence-split, denoise, Whisper
│   ├── 2_train.py               ← ⚠ ABANDONED: old XTTS v2 attempt, DO NOT USE
│   ├── 3_prepare_new.py         ← incremental: add new recordings to existing dataset
│   ├── extract_references.py    ← extract 20-30s reference clips from lectures
│   └── dataset/wavs/            ← 6,676 clean .wav clips (gitignored)
│
├── f5-training/
│   ├── prepare_dataset.py       ← STEP 2: LJSpeech CSV → F5-TTS format
│   ├── train.py                 ← STEP 3: accelerate launch → f5_tts finetune_cli
│   └── accelerate_config.yaml   ← bf16, single process (written for Apple M5 local dev)
│
├── tts-service/
│   ├── modal_app.py             ← PRODUCTION inference (Modal serverless T4 GPU)
│   └── main.py                  ← LOCAL DEV inference (auto-detects MPS/CUDA/CPU)
│
└── web/
    ├── app/page.tsx             ← entire UI (single "use client" page)
    ├── app/layout.tsx           ← fonts: Playfair Display + Inter
    ├── app/globals.css          ← warm parchment color palette (CSS variables)
    ├── public/osho.png          ← Osho photo used in About section
    ├── public/osho_real.wav     ← real recording used in Compare section
    └── .env.local               ← NEXT_PUBLIC_TTS_URL=https://...modal.run
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Model | F5-TTS (flow-matching), base: `F5TTS_v1_Base` |
| Training | PyTorch + HuggingFace Accelerate, ran on Colab A100 |
| Audio prep | pydub + noisereduce + Whisper medium |
| Backend (prod) | FastAPI + Modal serverless T4 GPU |
| Backend (dev) | FastAPI + uvicorn, local |
| Model storage | HuggingFace Hub |
| Frontend | Next.js **16** + React **19** + Tailwind **v4** + TypeScript |
| Deployment | Vercel (web) + Modal (GPU API) |

---

## Key Production Settings (modal_app.py)

| Setting | Value | Note |
|---|---|---|
| `nfe_step` | `32` | quality mode; local dev uses `16` |
| `ref_text` | `"It is the mind that has been trained into Aristotelian logic."` | hardcoded in both endpoints |
| `ref_audio` | `ref_01.wav` | stored in Modal Volume + HF Hub; used by both models |
| `scaledown_window` | `300` | GPU stays warm 5 min after last request |
| `timeout` | `120` | seconds per request |
| `gpu` | `T4` | |
| CORS | `allow_origins=["*"]` | |

### API Endpoints
| Endpoint | Model | Use |
|---|---|---|
| `POST /synthesize` | Fine-tuned (`model_last.pt`) | Main TTS for the player; accent baked in |
| `POST /synthesize-zeroshot` | Base `F5TTS_v1_Base` | Compare section; ref clip only, no training |
| `GET /health` | — | Returns status of both models |

Both models are loaded at container startup and share the same `ref_01.wav`.

---

## Training Details

- **Dataset:** 6,676 clips (~19h total), `voice-training/dataset/` (gitignored)
- **Pipeline:** silence-split (400ms / -40dB) → merge up to 12s → denoise (noisereduce 0.75) → Whisper medium transcribe → filter < 3 words
- **Format:** LJSpeech (`stem|text|text`) → converted to F5-TTS format via `prepare_dataset.py`
- **Hyperparams (Colab A100 run):** 20 epochs, lr=5e-6, batch=8 sample, flow-matching loss
- **Checkpoint size:** ~5.4 GB (`model_last.pt`)
- **Dataset on Drive:** `osho_dataset/` (raw.arrow, duration.json, vocab.txt)
- **Training checkpoint on Drive:** `osho_v2_checkpoint.pt`

---

## Frontend Architecture (web/app/page.tsx)

### Streaming Playback Pipeline
```
text → chunkText() → 800-char chunks at sentence boundaries
         │
         ▼
synthesizeChunk(chunk[0]) ← kicks off immediately
         │
    loop: await chunk[i], then synthesizeChunk(chunk[i+1]) in parallel
         │                (prefetch next while playing current)
         ▼
playUrl(url) → HTML5 Audio → onended → next chunk
```

### Speed Control
- Slider: 0.5× – 1.5× in 0.05 steps
- `speedRef` (ref, not state) so it's always current inside closures
- Changes take effect immediately on `currentAudio.current.playbackRate`

### UI States
`idle` → `loading` → `playing` ↔ `paused` → `done` / `error`

### Page Sections
1. **Nav** — "Osho Speaks" + "AI Voice Clone"
2. **Hero** — headline + subtext
3. **Player** — textarea, file upload (.txt), speed slider, progress bar, controls
4. **Compare** — real `/osho_real.wav` vs AI-generated (same sentence as ref_text)
5. **How it was built** — 01 Zero-shot failed, 02 19h audio, 03 Serverless GPU
6. **Quote** — random from 10 hardcoded Osho quotes (chosen on hydration)
7. **About** — Osho bio + project explanation
8. **Footer**

### Design System (globals.css)
```css
--background: #F4EFE6   /* warm parchment */
--foreground: #1A1714   /* near-black */
--accent:     #8B5E3C   /* warm brown */
--muted:      #9A8F83   /* grey-brown */
--border:     #D9D0C4   /* light tan */
```
Fonts: **Playfair Display** (headings, italic quotes) + **Inter** (body, UI)

---

## How to Update the Model

1. Train new checkpoint (on Colab A100 or similar)
2. Upload to HF Hub: `Hydrazinenv/osho-tts-model` as `model_last.pt`
3. Clear Modal volume cache (or rename volume) so it re-downloads on next cold start
4. Redeploy Modal: `modal deploy tts-service/modal_app.py`
5. Frontend needs no change

---

## Local Dev

```bash
# Backend (local)
cd tts-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py          # → http://localhost:8000

# Frontend
cd web
npm install
echo "NEXT_PUBLIC_TTS_URL=http://localhost:8000" > .env.local
npm run dev             # → http://localhost:3000
```

**Local vs prod differences:**
- `nfe_step`: 16 locally, 32 in production
- Device: auto-detected (MPS on Apple Silicon → CUDA → CPU)
- CORS: localhost:3000 only locally, `*` in production

---

## Gotchas & Important Notes

- **`voice-training/2_train.py` is dead code** — it's an old XTTS v2 attempt that was abandoned. The production model uses F5-TTS (`f5-training/` scripts).
- **`tts-service/requirements.txt` is stale** — still lists `TTS>=0.22.0` (XTTS library), not needed for F5-TTS inference. Modal image installs `f5-tts` directly.
- **`accelerate_config.yaml` has `use_cpu: true`** — written for local M5 dev. Actual training used Colab A100 with different settings (20 epochs, higher batch).
- **Next.js 16 has breaking changes** — `web/AGENTS.md` warns to read `node_modules/next/dist/docs/` before making changes. APIs differ from v13/14.
- **Cold start warning** — first GPU request wakes Modal (~2 min). The UI already shows this note. `scaledown_window=300` keeps it warm for 5 min after.
- **`/osho_real.wav`** must live in `web/public/` — it's the real recording used in the Compare section. Not committed to git (large binary).
- **Chunk size is 800 chars** — tuned to balance latency vs naturalness. Splitting happens at sentence boundaries (`[.!?]+`).
- **`ref_text` is hardcoded** in both `modal_app.py` and `main.py` — it must match what was actually said in `ref_01.wav` for F5-TTS to condition correctly.
