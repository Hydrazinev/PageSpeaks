"""
Phase 2: Fine-tune XTTS v2 on the prepared Osho dataset.
Runs on Apple M5 via MPS backend where supported.
Output model saved to: output/osho_xtts/
"""

import os
from pathlib import Path
from trainer import Trainer, TrainerArgs
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
from TTS.tts.datasets import load_tts_samples
from TTS.utils.manage import ModelManager
from TTS.config import BaseDatasetConfig

DATASET_DIR = Path(__file__).parent / "dataset"
OUTPUT_DIR = Path(__file__).parent / "output" / "osho_xtts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

LANGUAGE = "en"
BATCH_SIZE = 4      # 16GB unified memory can handle this
EPOCHS = 5
LEARNING_RATE = 5e-6


def main():
    # Download base XTTS v2 checkpoint if not present
    manager = ModelManager()
    model_path, config_path, _ = manager.download_model("tts_models/multilingual/multi-dataset/xtts_v2")

    # Dataset config (LJSpeech format)
    dataset_config = BaseDatasetConfig(
        formatter="ljspeech",
        meta_file_train="metadata.csv",
        path=str(DATASET_DIR),
        language=LANGUAGE,
    )

    # Load XTTS config from base checkpoint and override for fine-tuning
    config = XttsConfig()
    config.load_json(config_path)

    config.epochs = EPOCHS
    config.batch_size = BATCH_SIZE
    config.eval_batch_size = 1
    config.num_loader_workers = 8
    config.print_step = 50
    config.save_step = 1000
    config.save_n_checkpoints = 2
    config.save_checkpoints = True
    config.target_loss = "loss"
    config.print_eval = False
    config.run_name = "osho_xtts_finetune"
    config.output_path = str(OUTPUT_DIR)
    config.datasets = [dataset_config]

    # Optimizer settings
    config.optimizer = "AdamW"
    config.optimizer_params = {"betas": [0.9, 0.96], "eps": 1e-8, "weight_decay": 1e-2}
    config.lr_scheduler = "MultiStepLR"
    config.lr_scheduler_params = {"milestones": [50000, 150000, 300000], "gamma": 0.5, "last_epoch": -1}
    config.lr = LEARNING_RATE

    model = Xtts.init_from_config(config)
    model.load_checkpoint(config, checkpoint_dir=model_path, eval=False, use_deepspeed=False)

    train_samples, eval_samples = load_tts_samples(
        dataset_config,
        eval_split=True,
        eval_split_max_size=256,
        eval_split_size=0.01,
    )

    trainer = Trainer(
        TrainerArgs(
            restore_path=None,
            skip_train_epoch=False,
            start_with_eval=True,
            grad_accum_steps=4,   # effective batch = 16 with batch_size=4
        ),
        config,
        output_path=str(OUTPUT_DIR),
        model=model,
        train_samples=train_samples,
        eval_samples=eval_samples,
    )

    trainer.fit()
    print(f"\nTraining complete. Model saved to: {OUTPUT_DIR}")
    print("Next step: run the tts-service with  python ../tts-service/main.py")


if __name__ == "__main__":
    main()
