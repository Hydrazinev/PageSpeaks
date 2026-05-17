"""
Phase 1: Audio Preparation Pipeline
- Converts MP3s to 22050Hz mono WAV
- Denoises with noisereduce
- Segments into 2-12 second clips (splits on silence)
- Transcribes each clip with Whisper
- Outputs dataset/wavs/*.wav + dataset/metadata.csv (LJSpeech format)
"""

import os
import sys
import csv
import json
import torch
import whisper
import noisereduce as nr
import numpy as np
from pathlib import Path
from pydub import AudioSegment
from pydub.silence import split_on_silence
from tqdm import tqdm

sys.stdout = os.fdopen(sys.stdout.fileno(), "w", buffering=1)

def log(msg: str):
    print(msg, flush=True)

SOURCE_DIR = Path(__file__).parent.parent / "Osho Rec"
DATASET_DIR = Path(__file__).parent / "dataset"
WAVS_DIR = DATASET_DIR / "wavs"
SAMPLE_RATE = 22050
MIN_CLIP_MS = 2000
MAX_CLIP_MS = 12000

WAVS_DIR.mkdir(parents=True, exist_ok=True)


def convert_and_denoise(mp3_path: Path) -> np.ndarray:
    audio = AudioSegment.from_mp3(mp3_path)
    audio = audio.set_channels(1).set_frame_rate(SAMPLE_RATE)
    samples = np.array(audio.get_array_of_samples()).astype(np.float32) / 32768.0
    noise_sample = samples[: int(SAMPLE_RATE * 0.5)]
    reduced = nr.reduce_noise(y=samples, sr=SAMPLE_RATE, y_noise=noise_sample, prop_decrease=0.75)
    return reduced, audio


def segment_audio(mp3_path: Path) -> list[AudioSegment]:
    audio = AudioSegment.from_mp3(mp3_path)
    audio = audio.set_channels(1).set_frame_rate(SAMPLE_RATE)
    chunks = split_on_silence(
        audio,
        min_silence_len=400,
        silence_thresh=-40,
        keep_silence=150,
    )
    merged, current = [], None
    for chunk in chunks:
        if current is None:
            current = chunk
        elif len(current) + len(chunk) <= MAX_CLIP_MS:
            current += chunk
        else:
            if len(current) >= MIN_CLIP_MS:
                merged.append(current)
            current = chunk if len(chunk) <= MAX_CLIP_MS else None
    if current and len(current) >= MIN_CLIP_MS:
        merged.append(current)
    return merged


def transcribe_clips(wav_paths: list[Path], model) -> dict[str, str]:
    results = {}
    total = len(wav_paths)
    for i, wav_path in enumerate(wav_paths):
        result = model.transcribe(str(wav_path), language="en", fp16=False)
        text = result["text"].strip()
        if len(text.split()) >= 3:
            results[wav_path.stem] = text
        if (i + 1) % 50 == 0 or (i + 1) == total:
            pct = (i + 1) / total * 100
            log(f"  Transcribed {i+1}/{total} clips ({pct:.1f}%) — kept {len(results)} so far")
    return results


def main():
    import soundfile as sf

    mp3_files = sorted(SOURCE_DIR.glob("*.mp3"))
    log(f"Found {len(mp3_files)} source files")

    log("Loading Whisper model (medium)...")
    model = whisper.load_model("medium", device="cpu")
    log("Whisper model loaded.")

    all_wav_paths = []
    clip_index = 0

    for mp3_path in mp3_files:
        log(f"\nProcessing: {mp3_path.name}")
        chunks = segment_audio(mp3_path)
        log(f"  {len(chunks)} segments found")

        saved = []
        for j, chunk in enumerate(chunks):
            wav_name = f"osho_{clip_index:05d}"
            wav_path = WAVS_DIR / f"{wav_name}.wav"
            chunk.export(str(wav_path), format="wav")
            data, sr = sf.read(str(wav_path))
            if data.ndim > 1:
                data = data[:, 0]
            noise_sample = data[: int(sr * 0.3)]
            denoised = nr.reduce_noise(y=data, sr=sr, y_noise=noise_sample, prop_decrease=0.75)
            sf.write(str(wav_path), denoised, sr)
            saved.append(wav_path)
            clip_index += 1
            if (j + 1) % 100 == 0:
                log(f"  Saved {j+1}/{len(chunks)} WAVs...")

        log(f"  Saved all {len(chunks)} WAVs for {mp3_path.name}")
        all_wav_paths.extend(saved)

    log(f"\nTotal clips: {len(all_wav_paths)}")
    log("Starting Whisper transcription — updates every 50 clips...")
    transcriptions = transcribe_clips(all_wav_paths, model)

    metadata_path = DATASET_DIR / "metadata.csv"
    kept = 0
    with open(metadata_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter="|")
        for wav_path in all_wav_paths:
            stem = wav_path.stem
            if stem in transcriptions:
                text = transcriptions[stem]
                writer.writerow([stem, text, text])
                kept += 1
            else:
                wav_path.unlink()

    log(f"\nDone! Kept {kept} clips out of {len(all_wav_paths)}")
    log(f"Dataset saved to: {DATASET_DIR}")
    log("Next step: run  python 2_train.py")


if __name__ == "__main__":
    main()
