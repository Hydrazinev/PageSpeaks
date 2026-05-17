"""
Extract 5 high-quality 20-30 second reference clips from the original MP3s.
These are used for zero-shot voice cloning — longer + cleaner = better match.
"""
import sys
from pathlib import Path
from pydub import AudioSegment

SOURCE_DIR = Path(__file__).parent.parent / "Osho Rec"
OUT_DIR = Path(__file__).parent / "reference_clips"
OUT_DIR.mkdir(exist_ok=True)

# Extract 5 clips from different parts of different files for variety
clips = [
    ("Be Still and Know 07.mp3",  2*60*1000,  2*60*1000 + 25*1000),  # 2:00 - 2:25
    ("Be Still and Know 08.mp3",  5*60*1000,  5*60*1000 + 28*1000),  # 5:00 - 5:28
    ("Be Still and Know 09.mp3", 10*60*1000, 10*60*1000 + 30*1000),  # 10:00 - 10:30
    ("Christianity and Zen 01.mp3", 8*60*1000, 8*60*1000 + 27*1000), # 8:00 - 8:27
    ("Christianity and Zen 02.mp3", 15*60*1000,15*60*1000 + 30*1000),# 15:00 - 15:30
]

for i, (filename, start_ms, end_ms) in enumerate(clips):
    src = SOURCE_DIR / filename
    audio = AudioSegment.from_mp3(src)
    audio = audio.set_channels(1).set_frame_rate(22050)
    clip = audio[start_ms:end_ms]
    out_path = OUT_DIR / f"ref_{i+1:02d}.wav"
    clip.export(str(out_path), format="wav")
    duration = (end_ms - start_ms) / 1000
    print(f"Saved {out_path.name} ({duration:.0f}s) from {filename}")

print(f"\nDone — {len(clips)} reference clips in {OUT_DIR}")
