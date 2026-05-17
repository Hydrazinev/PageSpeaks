"""
Convert our LJSpeech metadata.csv → F5-TTS CSV format
then run F5-TTS dataset preparation.
"""
import csv
import subprocess
import sys
from pathlib import Path

WAVS_DIR = Path(__file__).parent.parent / "voice-training" / "dataset" / "wavs"
SRC_CSV  = Path(__file__).parent.parent / "voice-training" / "dataset" / "metadata.csv"
OUT_CSV  = Path(__file__).parent / "osho_metadata.csv"
OUT_DATA = Path(__file__).parent / "data" / "osho"

OUT_DATA.mkdir(parents=True, exist_ok=True)

print("Converting metadata to F5-TTS format...")
count = 0
with open(SRC_CSV, "r", encoding="utf-8") as fin, \
     open(OUT_CSV, "w", newline="", encoding="utf-8") as fout:
    writer = csv.writer(fout, delimiter="|")
    writer.writerow(["audio_file", "text"])
    for row in csv.reader(fin, delimiter="|"):
        if len(row) < 2:
            continue
        stem, text = row[0], row[1]
        abs_path = str((WAVS_DIR / f"{stem}.wav").resolve())
        writer.writerow([abs_path, text])
        count += 1

print(f"Wrote {count} rows to {OUT_CSV}")
print("\nRunning F5-TTS dataset preparation (this may take 10-20 min)...")

prepare_script = Path(__file__).parent / "venv/lib/python3.11/site-packages/f5_tts/train/datasets/prepare_csv_wavs.py"
result = subprocess.run(
    [sys.executable, str(prepare_script), str(OUT_CSV), str(OUT_DATA), "--workers", "8"],
    check=True
)
print(f"\nDataset prepared at: {OUT_DATA}")
print("Next: run  python train.py")
