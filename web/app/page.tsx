"use client";

import { useState, useRef, useEffect } from "react";

const CHUNK_SIZE = 800;
const TTS_URL = process.env.NEXT_PUBLIC_TTS_URL ?? "http://localhost:8000";

const QUOTES = [
  "The real question is not whether life exists after death. The real question is whether you are alive before death.",
  "Be — don't try to become.",
  "Life begins where fear ends.",
  "Experience life in all possible ways — good-bad, bitter-sweet, dark-light, summer-winter. Experience all the dualities.",
  "The moment you become miserly you are closed to the basic phenomenon of life: expansion, sharing, giving.",
  "Creativity is the greatest rebellion in existence.",
  "To be creative means to be in love with life.",
  "If you love a flower, don't pick it up. Because if you pick it up it dies and it ceases to be what you love.",
  "The less people know, the more stubbornly they know it.",
  "Whenever you are in doubt, existence has a way of making things clear to you — if you are open.",
];

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

const COMPARE_TEXT = "Meditation is not concentration. It is a state of pure awareness, a choiceless observation of what is.";

function CompareCard({
  label,
  sublabel,
  endpoint,
  buttonLabel = "▶  Generate",
}: {
  label: string;
  sublabel: string;
  endpoint: string;
  buttonLabel?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function generate() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${TTS_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: COMPARE_TEXT, speed: 1.0 }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      setUrl(URL.createObjectURL(blob));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "#EDE8DF", borderRadius: "6px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <p style={{ fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.2rem" }}>{label}</p>
        <p style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: 500 }}>{sublabel}</p>
      </div>
      <p style={{ fontFamily: "var(--font-playfair)", fontStyle: "italic", fontSize: "0.9rem", lineHeight: 1.6, color: "var(--foreground)" }}>
        &ldquo;{COMPARE_TEXT}&rdquo;
      </p>
      {url ? (
        <audio controls src={url} style={{ width: "100%" }} />
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          style={{
            padding: "0.6rem 1.25rem",
            background: "var(--foreground)",
            color: "var(--background)",
            border: "none",
            borderRadius: "4px",
            fontSize: "0.8rem",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.6 : 1,
            fontFamily: "var(--font-inter)",
            alignSelf: "flex-start",
          }}
        >
          {loading ? "Generating…" : buttonLabel}
        </button>
      )}
      {error && (
        <p style={{ fontSize: "0.75rem", color: "#C0392B" }}>GPU may be waking up — try again in a moment.</p>
      )}
    </div>
  );
}

export default function Home() {
  const [quote, setQuote] = useState(QUOTES[0]);
  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }, []);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const speedRef = useRef(1.0);
  const stopFlag = useRef(false);
  const pauseFlag = useRef(false);
  const currentAudio = useRef<HTMLAudioElement | null>(null);

  function handleSpeedChange(val: number) {
    setSpeed(val);
    speedRef.current = val;
    if (currentAudio.current) {
      currentAudio.current.playbackRate = val;
    }
  }

  useEffect(() => {
    return () => { stopFlag.current = true; };
  }, []);

  async function synthesizeChunk(chunk: string): Promise<string> {
    const res = await fetch(`${TTS_URL}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk, speed: 1.0 }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  async function playUrl(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.playbackRate = speedRef.current;
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
      // Kick off synthesis of first chunk immediately
      let upNext: Promise<string> = synthesizeChunk(chunks[0]);

      for (let i = 0; i < chunks.length; i++) {
        if (stopFlag.current) break;
        setProgress(i + 1);
        setStatus("loading");

        // Await the chunk that was already being synthesized in background
        const url = await upNext;

        // While we play this chunk, synthesize the next one in parallel
        if (i + 1 < chunks.length) {
          upNext = synthesizeChunk(chunks[i + 1]);
        }

        if (stopFlag.current) { URL.revokeObjectURL(url); break; }

        while (pauseFlag.current && !stopFlag.current) {
          await new Promise(r => setTimeout(r, 200));
        }
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
    <main style={{ background: "var(--background)", color: "var(--foreground)" }} className="min-h-screen">

      {/* Nav */}
      <nav className="flex justify-between items-center px-4 md:px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <span style={{ fontFamily: "var(--font-playfair)", fontSize: "1.05rem", letterSpacing: "0.05em" }}>
          Osho Speaks
        </span>
        <span style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          AI Voice Clone
        </span>
      </nav>

      {/* Hero */}
      <section className="px-4 md:px-8 pt-14 md:pt-24 pb-12 md:pb-20 max-w-5xl mx-auto">
        <p style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "1.25rem" }}>
          Fine-tuned on 19 hours of lectures
        </p>
        <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: "clamp(2.4rem, 8vw, 6rem)", fontWeight: 400, lineHeight: 1.05, maxWidth: "14ch" }}>
          Hear any text in his voice.
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "1rem", marginTop: "1.5rem", maxWidth: "44ch", lineHeight: 1.7, fontWeight: 300 }}>
          Paste a passage, a chapter, or an entire book — and listen to it read aloud exactly as Osho would have.
        </p>
      </section>

      {/* Player */}
      <section style={{ borderTop: "1px solid var(--border)", background: "#EDE8DF" }} className="px-4 md:px-8 py-12 md:py-20">
        <div className="max-w-3xl mx-auto">
          <p style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
            Listen
          </p>
          <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: "clamp(1.8rem, 5vw, 2.5rem)", fontWeight: 400, marginBottom: "0.5rem" }}>
            Enter your text
          </h2>
          <p style={{ fontSize: "0.8rem", marginBottom: "1.5rem", color: "var(--accent)", fontWeight: 500 }}>
            First request wakes the GPU (~2 min). Fast after that.
          </p>

          <textarea
            style={{
              width: "100%",
              background: "#F4EFE6",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "1rem",
              color: "var(--foreground)",
              fontSize: "0.9rem",
              lineHeight: 1.7,
              resize: "none",
              outline: "none",
              fontFamily: "var(--font-inter)",
            }}
            rows={7}
            placeholder="Paste a chapter, a passage, or your entire book here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isActive}
          />

          <div className="flex items-center justify-between mt-3 mb-5">
            <label style={{ cursor: "pointer", fontSize: "0.8rem", color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: "3px" }}>
              Upload .txt file
              <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} disabled={isActive} />
            </label>
            <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{text.length.toLocaleString()} chars</span>
          </div>

          {/* Speed */}
          <div className="flex items-center gap-3 mb-5">
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", whiteSpace: "nowrap" }}>Speed</span>
            <input
              type="range" min={0.5} max={1.5} step={0.05}
              value={speed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="flex-1"
              style={{ accentColor: "var(--accent)" }}
            />
            <span style={{ color: "var(--accent)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>{speed.toFixed(2)}×</span>
          </div>

          {/* Progress */}
          {isActive && (
            <div className="mb-5">
              <div style={{ height: "1px", background: "var(--border)", borderRadius: "1px", overflow: "hidden" }}>
                <div style={{ height: "100%", background: "var(--accent)", width: `${(progress / totalChunks) * 100}%`, transition: "width 0.5s ease" }} />
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.5rem", textAlign: "center" }}>
                {status === "loading" ? "Synthesizing…" : status === "paused" ? "Paused" : "Playing…"} &nbsp;{progress} / {totalChunks}
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3">
            {!isActive && (
              <button
                onClick={handlePlay}
                disabled={!text.trim()}
                style={{
                  flex: 1,
                  padding: "0.85rem",
                  background: "var(--foreground)",
                  color: "var(--background)",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                  cursor: text.trim() ? "pointer" : "not-allowed",
                  opacity: text.trim() ? 1 : 0.4,
                  fontFamily: "var(--font-inter)",
                }}
              >
                ▶  Play
              </button>
            )}
            {isActive && (
              <>
                <button
                  onClick={handlePause}
                  disabled={status === "loading"}
                  style={{
                    flex: 1,
                    padding: "0.85rem",
                    background: "var(--foreground)",
                    color: "var(--background)",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    opacity: status === "loading" ? 0.4 : 1,
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  {status === "paused" ? "▶  Resume" : "⏸  Pause"}
                </button>
                <button
                  onClick={handleStop}
                  style={{
                    padding: "0.85rem 1.25rem",
                    background: "transparent",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  ■ Stop
                </button>
              </>
            )}
          </div>

          {status === "done" && (
            <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.85rem", marginTop: "1rem" }}>Finished reading.</p>
          )}
          {status === "error" && (
            <p style={{ textAlign: "center", color: "#C0392B", fontSize: "0.85rem", marginTop: "1rem" }}>
              Could not reach the TTS service. The GPU may be waking up — try again in a moment.
            </p>
          )}
        </div>
      </section>

      {/* Compare */}
      <section style={{ borderTop: "1px solid var(--border)" }} className="px-4 md:px-8 py-12 md:py-20">
        <div className="max-w-6xl mx-auto">
          <p style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Compare</p>
          <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: "clamp(1.6rem, 4vw, 2rem)", fontWeight: 400, marginBottom: "0.5rem" }}>Real · Zero-shot · Fine-tuned</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 300, marginBottom: "0.5rem", maxWidth: "54ch", lineHeight: 1.7 }}>
            Same sentence, three versions. Zero-shot clones the voice from a 10-second clip at inference time — no training.
            Fine-tuned was trained on 19 hours of audio. Hear the difference the accent makes.
          </p>
          <p style={{ color: "var(--accent)", fontSize: "0.8rem", fontWeight: 500, marginBottom: "2rem" }}>
            ↓ Generate both AI versions to compare
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1 — Real */}
            <div style={{ background: "#EDE8DF", borderRadius: "6px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <p style={{ fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.2rem" }}>Original Recording</p>
                <p style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: 500 }}>The real voice</p>
              </div>
              <p style={{ fontFamily: "var(--font-playfair)", fontStyle: "italic", fontSize: "0.9rem", lineHeight: 1.6, color: "var(--foreground)" }}>
                &ldquo;It is the mind that has been trained into Aristotelian logic.&rdquo;
              </p>
              <audio controls src="/osho_real.wav" style={{ width: "100%" }} />
            </div>

            {/* Card 2 — Zero-shot */}
            <CompareCard
              label="Zero-shot Clone"
              sublabel="4-second ref clip · base model · no training"
              endpoint="/synthesize-zeroshot"
              buttonLabel="▶  Generate zero-shot"
            />

            {/* Card 3 — Fine-tuned */}
            <CompareCard
              label="Fine-tuned Clone"
              sublabel="19 hours of training · accent baked in"
              endpoint="/synthesize"
              buttonLabel="▶  Generate fine-tuned"
            />
          </div>
        </div>
      </section>

      {/* How it was built */}
      <section style={{ borderTop: "1px solid var(--border)" }} className="px-4 md:px-8 py-12 md:py-20">
        <div className="max-w-5xl mx-auto">
          <p style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Process</p>
          <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: "clamp(1.6rem, 4vw, 2rem)", fontWeight: 400, marginBottom: "0.5rem" }}>How it was built</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 300, marginBottom: "3rem", maxWidth: "52ch", lineHeight: 1.7 }}>
            The obvious approach didn&apos;t work. You can hear exactly why in the Compare section above.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            <div>
              <p style={{ fontFamily: "var(--font-playfair)", fontSize: "2.5rem", color: "var(--border)", lineHeight: 1, marginBottom: "1rem" }}>01</p>
              <h3 style={{ fontFamily: "var(--font-playfair)", fontSize: "1.1rem", fontWeight: 500, marginBottom: "0.75rem" }}>Zero-shot failed</h3>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.8, fontWeight: 300 }}>
                F5-TTS can clone a voice from a 10-second reference clip — no training needed. The pitch and rhythm were close. But the accent was off. A short clip doesn&apos;t have enough coverage of every phoneme, so the model fills the gaps with standard English.
              </p>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-playfair)", fontSize: "2.5rem", color: "var(--border)", lineHeight: 1, marginBottom: "1rem" }}>02</p>
              <h3 style={{ fontFamily: "var(--font-playfair)", fontSize: "1.1rem", fontWeight: 500, marginBottom: "0.75rem" }}>19 hours of audio</h3>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.8, fontWeight: 300 }}>
                Collected 19 hours of Osho&apos;s lectures. Built a pipeline to split on silence, denoise each clip, and transcribe with Whisper — producing 6,676 clean training samples. Fine-tuned F5-TTS on a Colab A100 until the accent was baked into the model weights.
              </p>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-playfair)", fontSize: "2.5rem", color: "var(--border)", lineHeight: 1, marginBottom: "1rem" }}>03</p>
              <h3 style={{ fontFamily: "var(--font-playfair)", fontSize: "1.1rem", fontWeight: 500, marginBottom: "0.75rem" }}>Serverless GPU</h3>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.8, fontWeight: 300 }}>
                The 5.4 GB checkpoint lives on Hugging Face Hub. Modal downloads it once, caches it on a Volume, and runs inference on a T4 GPU — only when a request comes in. Zero idle cost. The frontend streams audio chunk by chunk so playback starts within seconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quote */}
      <section style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }} className="px-4 md:px-8 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <blockquote style={{ fontFamily: "var(--font-playfair)", fontSize: "clamp(1.1rem, 3vw, 1.6rem)", fontWeight: 400, lineHeight: 1.5, fontStyle: "italic" }}>
            &ldquo;{quote}&rdquo;
          </blockquote>
          <p style={{ color: "var(--muted)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "1.25rem" }}>
            — Osho
          </p>
        </div>
      </section>

      {/* About */}
      <section className="px-4 md:px-8 py-12 md:py-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <img
              src="/osho.png"
              alt="Osho"
              style={{
                width: "140px",
                flexShrink: 0,
                borderRadius: "4px",
                filter: "grayscale(20%)",
                objectFit: "cover",
              }}
            />
            <div>
              <p style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.75rem" }}>About</p>
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 400, lineHeight: 1.2, marginBottom: "1rem" }}>
                Osho (1931–1990)
              </h2>
              <p style={{ color: "var(--muted)", lineHeight: 1.8, fontWeight: 300, fontSize: "0.95rem" }}>
                Born Chandra Mohan Jain in India, Osho was a philosopher, mystic, and one of the most prolific spiritual speakers of the 20th century. Speaking extemporaneously for over two decades, he left behind more than 600 volumes of transcribed lectures spanning Zen, Taoism, Sufism, Western philosophy, and the full breadth of human consciousness.
              </p>
            </div>
          </div>
          <div className="md:border-l md:pl-8" style={{ borderColor: "var(--border)" }}>
            <p style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.75rem" }}>This Project</p>
            <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 400, lineHeight: 1.2, marginBottom: "1rem" }}>
              How it works
            </h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.8, fontWeight: 300, fontSize: "0.95rem" }}>
              F5-TTS — a flow-matching voice model — was fine-tuned on 19 hours of Osho&apos;s lectures: segmented, denoised, and transcribed using Whisper. The model runs on a serverless GPU and streams audio chunk by chunk, so playback begins within seconds.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border)" }} className="px-4 md:px-8 py-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <span style={{ fontFamily: "var(--font-playfair)", fontSize: "0.95rem" }}>Osho Speaks</span>
          <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>F5-TTS · Modal · Vercel</span>
        </div>
      </footer>

    </main>
  );
}
