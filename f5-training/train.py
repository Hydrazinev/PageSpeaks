"""
F5-TTS fine-tuning on Osho dataset with MPS (Apple M5 GPU) support.
Wraps f5-tts_finetune-cli with correct params and accelerate config.
"""
import os
import subprocess
import sys
from pathlib import Path

os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
os.environ["PYTORCH_MPS_HIGH_WATERMARK_RATIO"] = "0.0"

# Setting num_workers=0 avoids multiprocessing overhead that competes with MPS for memory
import yaml
cfg_path = Path(__file__).parent / "venv/lib/python3.11/site-packages/f5_tts/configs/F5TTS_v1_Base.yaml"
cfg = yaml.safe_load(cfg_path.read_text())
cfg["datasets"]["num_workers"] = 0
cfg_path.write_text(yaml.dump(cfg))

DATASET_NAME = "osho"
DATA_DIR     = Path(__file__).parent / "data" / "osho"
CKPT_DIR     = Path(__file__).parent / "checkpoints"
ACCEL_CFG    = Path(__file__).parent / "accelerate_config.yaml"

CKPT_DIR.mkdir(exist_ok=True)

if not DATA_DIR.exists():
    print("Dataset not found! Run  python prepare_dataset.py  first.")
    sys.exit(1)

cmd = [
    "accelerate", "launch",
    "--config_file", str(ACCEL_CFG),
    "-m", "f5_tts.train.finetune_cli",
    "--exp_name",               "F5TTS_v1_Base",
    "--dataset_name",           DATASET_NAME,
    "--epochs",                 "5",
    "--learning_rate",          "1e-5",
    "--batch_size_per_gpu",     "2",
    "--batch_size_type",        "sample",
    "--max_samples",            "16",
    "--grad_accumulation_steps","2",
    "--max_grad_norm",          "1.0",
    "--num_warmup_updates",     "100",
    "--save_per_updates",       "500",
    "--keep_last_n_checkpoints","2",
    "--last_per_updates",       "100",
    "--finetune",
]

log_path = Path(__file__).parent / "train.log"
print("Starting F5-TTS fine-tuning on MPS (Apple M5 GPU)...")
print(f"Dataset: {DATA_DIR}")
print(f"Epochs: 5  |  Batch: 4  |  Device: MPS")
print(f"Live log: tail -f {log_path}\n")

with open(log_path, "w") as log:
    proc = subprocess.Popen(cmd, stdout=log, stderr=log)
    proc.wait()
