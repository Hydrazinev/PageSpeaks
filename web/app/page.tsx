"use client";

import { useState, useRef, useEffect } from "react";

const CHUNK_SIZE = 800;
const TTS_URL = process.env.NEXT_PUBLIC_TTS_URL ?? "http://localhost:8000";

function chunkText(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length > CHUNK_SIZE) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export default function Home() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const stopFlag = useRef(false);
  const pauseFlag = useRef(false);
  const currentAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => { stopFlag.current = true; };
  }, []);

  async function synthesizeChunk(chunk: string): Promise<string> {
    const res = await fetch(`${TTS_URL}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk, speed }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  async function playUrl(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      currentAudio.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = reject;
      audio.play();
    });
  }

  async function handlePlay() {
    if (!text.trim()) return;
    stopFlag.current = false;
    pauseFlag.current = false;
    const chunks = chunkText(text);
    setTotalChunks(chunks.length);
    setProgress(0);
    setStatus("loading");
    try {
      for (let i = 0; i < chunks.length; i++) {
        if (stopFlag.current) break;

        // Wait while paused
        while (pauseFlag.current && !stopFlag.current) {
          await new Promise(r => setTimeout(r, 200));
        }
        if (stopFlag.current) break;

        setProgress(i + 1);
        setStatus("loading");
        const url = await synthesizeChunk(chunks[i]);
        if (stopFlag.current) { URL.revokeObjectURL(url); break; }
        setStatus("playing");
        await playUrl(url);
      }
      setStatus(stopFlag.current ? "idle" : "done");
    } catch {
      setStatus("error");
    }
  }

  function handleStop() {
    stopFlag.current = true;
    pauseFlag.current = false;
    currentAudio.current?.pause();
    currentAudio.current = null;
    setStatus("idle");
    setProgress(0);
  }

  function handlePause() {
    if (status === "playing") {
      pauseFlag.current = true;
      currentAudio.current?.pause();
      setStatus("paused");
    } else if (status === "paused") {
      pauseFlag.current = false;
      currentAudio.current?.play();
      setStatus("playing");
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText(ev.target?.result as string);
    reader.readAsText(file);
  }

  const isActive = status === "loading" || status === "playing" || status === "paused";

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-serif font-light tracking-wide text-amber-200">
            Osho Speaks
          </h1>
          <p className="text-stone-400 text-sm">
            Paste any text or upload a book — hear it in Osho&apos;s voice
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-xs uppercase tracking-widest text-stone-500">Text or Book</label>
          <textarea
            className="w-full h-56 bg-stone-900 border border-stone-700 rounded-xl p-4 text-stone-100
                       placeholder:text-stone-600 resize-none focus:outline-none focus:border-amber-700 text-sm leading-relaxed"
            placeholder="Paste a chapter, a passage, or your entire book here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isActive}
          />
          <div className="flex items-center gap-3">
            <label className="cursor-pointer text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2">
              Upload .txt file
              <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} disabled={isActive} />
            </label>
            <span className="text-stone-600 text-xs">{text.length.toLocaleString()} characters</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-xs uppercase tracking-widest text-stone-500 w-16">Speed</label>
          <input
            type="range" min={0.5} max={1.5} step={0.05}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="flex-1 accent-amber-500"
            disabled={isActive}
          />
          <span className="text-amber-300 text-sm w-12 text-right">{speed.toFixed(2)}×</span>
        </div>

        {isActive && (
          <div className="space-y-2">
            <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${(progress / totalChunks) * 100}%` }}
              />
            </div>
            <p className="text-xs text-stone-500 text-center">
              {status === "loading" ? "Synthesizing…" : status === "paused" ? "Paused" : "Playing…"} segment {progress} / {totalChunks}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          {!isActive && (
            <button
              onClick={handlePlay}
              disabled={!text.trim()}
              className="flex-1 py-3 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40
                         disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              ▶  Play
            </button>
          )}
          {isActive && (
            <>
              <button
                onClick={handlePause}
                disabled={status === "loading"}
                className="flex-1 py-3 rounded-xl bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-white transition-colors"
              >
                {status === "paused" ? "▶  Resume" : "⏸  Pause"}
              </button>
              <button
                onClick={handleStop}
                className="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-white transition-colors"
              >
                ■ Stop
              </button>
            </>
          )}
        </div>

        {status === "done" && (
          <p className="text-center text-stone-500 text-sm">Finished reading.</p>
        )}
        {status === "error" && (
          <p className="text-center text-red-400 text-sm">
            Error — could not reach the TTS service
          </p>
        )}

      </div>
    </main>
  );
}
