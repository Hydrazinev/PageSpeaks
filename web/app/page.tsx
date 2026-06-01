"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const CHUNK_SIZE = 800;
const TTS_URL = process.env.NEXT_PUBLIC_TTS_URL ?? "http://localhost:8000";
const VOICE_SPEED_DEFAULTS: Record<Voice, number> = {
  osho: 1.0,
  morgan: 0.65,
};

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

const MORGAN_QUOTES = [
  "Was I always going to be here? No. I was not. I chose to be here.",
  "Challenge yourself; it's the only path which leads to growth.",
  "I always tell my kids if you lay down, people will step over you. But if you keep scrambling, if you keep going, someone will always, always give you a hand.",
  "How do we change the world? One random act of kindness at a time.",
  "If you live a life of make-believe, your life isn't worth anything until you do something that does challenge your reality.",
  "Learning how to be still, to really be still and let life happen — that stillness becomes a radiance.",
  "The best way to guarantee a loss is to quit.",
  "I've had to work hard and show people who I am day in and day out.",
];

type Voice = "osho" | "morgan";

const VOICES: { id: Voice; label: string }[] = [
  { id: "osho", label: "Osho" },
  { id: "morgan", label: "Morgan Freeman" },
];

// Add your video URLs here. Leave empty string for gradient-only fallback.
const HERO_VIDEOS: Record<Voice, string> = {
  osho: "/hero-osho.mp4",
  morgan: "/hero-morgan.mp4",
};

// Gradient shown when no video is set (or while video loads)
const HERO_GRADIENTS: Record<Voice, string> = {
  osho: "radial-gradient(ellipse at 20% 60%, #4A2010 0%, #1A0C05 50%, #0A0503 100%)",
  morgan:
    "radial-gradient(ellipse at center top, #1C2035 0%, #0D0F1A 50%, #050608 100%)",
};

// Bottom-of-hero overlay that fades into the page background
const HERO_OVERLAYS: Record<Voice, string> = {
  osho: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(15,8,3,0.55) 55%, rgba(26,12,5,0.88) 100%)",
  morgan:
    "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(5,6,10,0.65) 55%, rgba(13,15,20,0.95) 100%)",
};

const VOICE_CONTENT: Record<
  Voice,
  {
    brand: string;
    accentLabel: string;
    heroHeading: string;
    heroSub: string;
    textareaPlaceholder: string;
    aboutName: string;
    aboutBio: string;
    image: string;
    imageAlt: string;
    quotes: string[];
    attribution: string;
    processSubtitle: string;
    howItWorksBody: string;
    steps: { num: string; title: string; body: string }[];
  }
> = {
  osho: {
    brand: "PageSpeaks",
    accentLabel: "Osho — Fine-tuned on 19 hours of lectures",
    heroHeading: "Hear any text in his voice.",
    heroSub:
      "Paste a passage, a chapter, or an entire book — and listen to it read aloud exactly as Osho would have.",
    textareaPlaceholder:
      "Paste a chapter, a passage, or your entire book here…",
    aboutName: "Osho (1931–1990)",
    aboutBio:
      "Born Chandra Mohan Jain in India, Osho was a philosopher, mystic, and one of the most prolific spiritual speakers of the 20th century. Speaking extemporaneously for over two decades, he left behind more than 600 volumes of transcribed lectures spanning Zen, Taoism, Sufism, Western philosophy, and the full breadth of human consciousness.",
    image: "/osho.png",
    imageAlt: "Osho",
    quotes: QUOTES,
    attribution: "— Osho",
    processSubtitle:
      "The obvious approach didn't work. Here's what it took to actually get the accent right.",
    howItWorksBody:
      "F5-TTS — a flow-matching voice model — was fine-tuned on 19 hours of Osho's lectures: segmented, denoised, and transcribed using Whisper. The model runs on a serverless GPU and streams audio chunk by chunk, so playback begins within seconds.",
    steps: [
      {
        num: "01",
        title: "Zero-shot failed",
        body: "F5-TTS can clone a voice from a 10-second reference clip — no training needed. The pitch and rhythm were close. But the accent was off. A short clip doesn't have enough coverage of every phoneme, so the model fills the gaps with standard English.",
      },
      {
        num: "02",
        title: "19 hours of audio",
        body: "Collected 19 hours of Osho's lectures. Built a pipeline to split on silence, denoise each clip, and transcribe with Whisper — producing 6,676 clean training samples. Fine-tuned F5-TTS on a Colab A100 until the accent was baked into the model weights.",
      },
      {
        num: "03",
        title: "Serverless GPU",
        body: "The 5.4 GB checkpoint lives on Hugging Face Hub. Modal downloads it once, caches it on a Volume, and runs inference on a T4 GPU — only when a request comes in. Zero idle cost. The frontend streams audio chunk by chunk so playback starts within seconds.",
      },
    ],
  },
  morgan: {
    brand: "PageSpeaks",
    accentLabel: "Morgan Freeman — Fine-tuned on 5.5 hours of narration",
    heroHeading: "Hear any text in his voice.",
    heroSub:
      "Paste a script, a story, or a documentary treatment — and hear it narrated exactly as Morgan Freeman would.",
    textareaPlaceholder: "Paste a script, a passage, or a story here…",
    aboutName: "Morgan Freeman (b. 1937)",
    aboutBio:
      "Morgan Freeman is one of the most recognized voices in cinema — known for narrating everything from The Shawshank Redemption to March of the Penguins. His deep, measured cadence has become synonymous with gravitas, wisdom, and trust.",
    image: "/morgan.png",
    imageAlt: "Morgan Freeman",
    quotes: MORGAN_QUOTES,
    attribution: "— Morgan Freeman",
    processSubtitle:
      "Capturing the voice behind the documentaries wasn't straightforward.",
    howItWorksBody:
      "F5-TTS — a flow-matching voice model — was fine-tuned on 5.5 hours of Morgan Freeman's narration: segmented, denoised, and speaker-verified using resemblyzer. The model runs on a serverless GPU alongside the Osho model and streams audio chunk by chunk.",
    steps: [
      {
        num: "01",
        title: "Zero-shot narration",
        body: "F5-TTS can voice-clone from a short clip — but out of the box, it didn't capture Morgan's deep, measured pace. The result was too fast, too flat. Zero-shot isn't enough for a voice this distinctive.",
      },
      {
        num: "02",
        title: "5.5 hours of narration",
        body: "Collected 5.5 hours of clean Morgan Freeman narration — documentaries, audiobooks, interviews. Built a speaker-verification pipeline using resemblyzer to filter out everything that wasn't him.",
      },
      {
        num: "03",
        title: "Serverless GPU",
        body: "The 5.4 GB checkpoint lives on Hugging Face Hub and loads into a Modal T4 GPU on first request. Two models fit on one GPU — Osho and Morgan share the same serverless instance.",
      },
    ],
  },
};

const COMPARE_CONTENT: Record<
  Voice,
  { text: string; quote: string; speaker: Voice; speed: number }
> = {
  osho: {
    text: "It is the mind that has been trained into Aristotelian logic.",
    quote: "“It is the mind that has been trained into Aristotelian logic.”",
    speaker: "osho",
    speed: 1.0,
  },
  morgan: {
    text: "How did the universe begin? We’ve all heard of the Big Bang, but how do we really know that’s the way it was?",
    quote:
      "“How did the universe begin? We’ve all heard of the Big Bang, but how do we really know that’s the way it was?”",
    speaker: "morgan",
    speed: 1.0,
  },
};

// ── Utility functions ────────────────────────────────────────────────────────

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++)
    view.setUint8(offset + i, str.charCodeAt(i));
}

function encodeWAV(buffer: AudioBuffer): ArrayBuffer {
  const samples = buffer.getChannelData(0);
  const byteLen = 44 + samples.length * 2;
  const ab = new ArrayBuffer(byteLen);
  const v = new DataView(ab);
  writeString(v, 0, "RIFF");
  v.setUint32(4, byteLen - 8, true);
  writeString(v, 8, "WAVE");
  writeString(v, 12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeString(v, 36, "data");
  v.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return ab;
}

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

// ── VideoBackground ──────────────────────────────────────────────────────────

function VideoBackground({ src, fallback }: { src: string; fallback: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadingOutRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  const cancelFade = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const fadeIn = useCallback(
    (el: HTMLVideoElement, duration = 250) => {
      cancelFade();
      const startOpacity =
        el.style.opacity === "" ? 0 : parseFloat(el.style.opacity);
      const t0 = performance.now();
      function step(now: number) {
        const p = Math.min((now - t0) / duration, 1);
        el.style.opacity = String(startOpacity + (1 - startOpacity) * p);
        if (p < 1) rafRef.current = requestAnimationFrame(step);
        else rafRef.current = null;
      }
      rafRef.current = requestAnimationFrame(step);
    },
    [cancelFade],
  );

  const fadeOut = useCallback(
    (el: HTMLVideoElement, duration = 250, onDone?: () => void) => {
      cancelFade();
      const startOpacity =
        el.style.opacity === "" ? 1 : parseFloat(el.style.opacity);
      const t0 = performance.now();
      function step(now: number) {
        const p = Math.min((now - t0) / duration, 1);
        el.style.opacity = String(startOpacity * (1 - p));
        if (p < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          onDone?.();
        }
      }
      rafRef.current = requestAnimationFrame(step);
    },
    [cancelFade],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting && video.paused && video.src) {
          video.play().catch(() => {});
        } else if (!entry.isIntersecting && !video.paused) {
          video.pause();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || !isVisible) return;

    video.style.opacity = "0";
    fadingOutRef.current = false;

    function handleCanPlay() {
      if (video) fadeIn(video);
    }
    function handleTimeUpdate() {
      if (!video || fadingOutRef.current) return;
      const remaining = video.duration - video.currentTime;
      if (remaining <= 0.55 && video.duration > 0) {
        fadingOutRef.current = true;
        fadeOut(video);
      }
    }
    function handleEnded() {
      if (!video) return;
      video.style.opacity = "0";
      setTimeout(() => {
        if (!video) return;
        video.currentTime = 0;
        fadingOutRef.current = false;
        video
          .play()
          .then(() => fadeIn(video))
          .catch(() => {});
      }, 100);
    }

    video.src = src;
    video.load();
    video.play().catch(() => {});
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      cancelFade();
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      video.pause();
    };
  }, [src, fadeIn, fadeOut, cancelFade, isVisible]);

  useEffect(() => () => cancelFade(), [cancelFade]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: fallback,
      }}
    >
      {src && (
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            opacity: 0,
          }}
        />
      )}
    </div>
  );
}

// ── CompareAI ────────────────────────────────────────────────────────────────

function CompareAI({ voice }: { voice: Voice }) {
  const [aiUrl, setAiUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cc = COMPARE_CONTENT[voice];

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(`${TTS_URL}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cc.text,
          speed: cc.speed,
          speaker: cc.speaker,
        }),
      });
      const blob = await res.blob();
      setAiUrl(URL.createObjectURL(blob));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="card-lift"
      style={{
        background: "var(--card-bg)",
        borderRadius: "6px",
        padding: "1.5rem",
      }}
    >
      <p
        style={{
          fontSize: "0.7rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: "0.75rem",
        }}
      >
        AI Clone
      </p>
      <p
        style={{
          fontFamily: "var(--font-playfair)",
          fontStyle: "italic",
          fontSize: "0.95rem",
          lineHeight: 1.6,
          marginBottom: "1.25rem",
          color: "var(--foreground)",
        }}
      >
        {cc.quote}
      </p>
      {aiUrl ? (
        <audio controls src={aiUrl} style={{ width: "100%" }} />
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          className="btn btn-primary"
          style={{
            padding: "0.6rem 1.25rem",
            background: "var(--foreground)",
            color: "var(--background)",
            border: "none",
            borderRadius: "4px",
            fontSize: "0.8rem",
            opacity: loading ? 0.5 : 1,
            fontFamily: "var(--font-inter)",
          }}
        >
          {loading ? "Generating…" : "▶ Generate AI version"}
        </button>
      )}
    </div>
  );
}

// ── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [voice, setVoice] = useState<Voice>("osho");
  const [quote, setQuote] = useState(VOICE_CONTENT["osho"].quotes[0]);

  const VOICE_SPEED_DEFAULTS: Record<Voice, number> = {
    osho: 1.0,
    morgan: 0.65,
  };

  const [text, setText] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "playing" | "paused" | "done" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const speedRef = useRef(1.0);
  const stopFlag = useRef(false);
  const pauseFlag = useRef(false);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const downloadBlobs = useRef<Blob[]>([]);
  const [downloading, setDownloading] = useState(false);
  const abortController = useRef<AbortController | null>(null);
  const blobUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    document.body.setAttribute("data-voice", voice);
    const quotes = VOICE_CONTENT[voice].quotes;
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    handleSpeedChange(VOICE_SPEED_DEFAULTS[voice]);
  }, [voice]);

  function handleSpeedChange(val: number) {
    setSpeed(val);
    speedRef.current = val;
    if (currentAudio.current) {
      currentAudio.current.playbackRate = val;
    }
  }

  useEffect(() => {
    return () => {
      stopFlag.current = true;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (status === "playing" || status === "paused") handlePause();
        else if (
          (status === "idle" || status === "done" || status === "error") &&
          text.trim()
        )
          handlePlay();
      }
      if (
        e.code === "Escape" &&
        (status === "loading" || status === "playing" || status === "paused")
      )
        handleStop();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, text]); // eslint-disable-line react-hooks/exhaustive-deps

  async function synthesizeChunk(
    chunk: string,
    speaker: Voice,
  ): Promise<string> {
    try {
      const res = await fetch(`${TTS_URL}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk, speed: speedRef.current, speaker }),
        signal: abortController.current?.signal,
      });
      if (!res.ok) {
        throw new Error(
          "Synthesis failed. Check your connection and try again.",
        );
      }
      const blob = await res.blob();
      downloadBlobs.current.push(blob);
      const url = URL.createObjectURL(blob);
      blobUrls.current.add(url);
      return url;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return "";
      }
      throw err;
    }
  }

  async function playUrl(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.playbackRate = speedRef.current;
      currentAudio.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = reject;
      audio.play();
    });
  }

  async function handleDownload() {
    if (downloadBlobs.current.length === 0) return;
    setDownloading(true);
    try {
      const ctx = new AudioContext();
      const buffers = await Promise.all(
        downloadBlobs.current.map(async (blob) => {
          const ab = await blob.arrayBuffer();
          return ctx.decodeAudioData(ab);
        }),
      );
      const totalLen = buffers.reduce((s, b) => s + b.length, 0);
      const merged = ctx.createBuffer(1, totalLen, buffers[0].sampleRate);
      const ch = merged.getChannelData(0);
      let offset = 0;
      for (const buf of buffers) {
        ch.set(buf.getChannelData(0), offset);
        offset += buf.length;
      }
      await ctx.close();
      const url = URL.createObjectURL(
        new Blob([encodeWAV(merged)], { type: "audio/wav" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `${voice}-voice.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setDownloading(false);
    }
  }

  async function handlePlay() {
    if (!text.trim()) return;
    downloadBlobs.current = [];
    blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrls.current.clear();
    stopFlag.current = false;
    pauseFlag.current = false;
    abortController.current = new AbortController();
    const chunks = chunkText(text);
    setTotalChunks(chunks.length);
    setProgress(0);
    setStatus("loading");
    const currentVoice = voice;
    try {
      let upNext: Promise<string> = synthesizeChunk(chunks[0], currentVoice);
      for (let i = 0; i < chunks.length; i++) {
        if (stopFlag.current || voice !== currentVoice) break;
        setProgress(i + 1);
        setStatus("loading");
        const url = await upNext;
        if (!url) break;
        if (i + 1 < chunks.length && voice === currentVoice) {
          upNext = synthesizeChunk(chunks[i + 1], currentVoice);
        }
        if (stopFlag.current || voice !== currentVoice) {
          URL.revokeObjectURL(url);
          blobUrls.current.delete(url);
          break;
        }
        while (
          pauseFlag.current &&
          !stopFlag.current &&
          voice === currentVoice
        ) {
          await new Promise((r) => setTimeout(r, 200));
        }
        if (stopFlag.current || voice !== currentVoice) {
          URL.revokeObjectURL(url);
          blobUrls.current.delete(url);
          break;
        }
        setStatus("playing");
        await playUrl(url);
        blobUrls.current.delete(url);
      }
      setStatus(
        stopFlag.current ? "idle" : voice === currentVoice ? "done" : "idle",
      );
    } catch (err) {
      setStatus("error");
    }
  }

  function handleStop() {
    stopFlag.current = true;
    pauseFlag.current = false;
    abortController.current?.abort();
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

  const isActive =
    status === "loading" || status === "playing" || status === "paused";

  const vc = VOICE_CONTENT[voice];

  return (
    <main
      style={{ background: "var(--background)", color: "var(--foreground)" }}
      className="min-h-screen"
    >
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className="nav-sticky flex justify-between items-center px-6 md:px-10 py-5"
        style={{ zIndex: 100 }}
      >
        <span
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "1.05rem",
            letterSpacing: "0.05em",
          }}
        >
          {vc.brand}
        </span>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Listen", href: "#player" },
            { label: "How it was built", href: "#process" },
            { label: "About", href: "#about" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: "0.85rem",
                color: "var(--muted)",
                textDecoration: "none",
                fontWeight: 400,
              }}
            >
              {item.label}
            </a>
          ))}
          <a
            href="#player"
            className="btn"
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "0.8rem",
              fontWeight: 500,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "999px",
              padding: "0.45rem 1.1rem",
              textDecoration: "none",
              letterSpacing: "0.01em",
            }}
          >
            Try now →
          </a>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          minHeight: "calc(100vh - 73px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Video / gradient background */}
        <VideoBackground
          src={HERO_VIDEOS[voice]}
          fallback={HERO_GRADIENTS[voice]}
        />

        {/* Gradient overlay — fades to page bg at bottom */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: HERO_OVERLAYS[voice],
            zIndex: 1,
            transition: "background 600ms ease-out",
          }}
        />

        {/* Hero content */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            padding: "0 2rem",
            maxWidth: "72rem",
            margin: "0 auto",
            width: "100%",
            paddingBottom: "80px",
          }}
        >
          {/* Headline */}
          <h1
            className="hero-reveal"
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "clamp(3.2rem, 11vw, 8.5rem)",
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              maxWidth: "12ch",
              color: "#ffffff",
              marginBottom: "2rem",
            }}
          >
            Hear any text in{" "}
            <em
              style={{
                fontStyle: "italic",
                fontWeight: 400,
                color: "var(--accent)",
              }}
            >
              his
            </em>{" "}
            voice.
          </h1>

          {/* Subtitle */}
          <p
            className="hero-reveal hero-reveal-delay-1"
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: "clamp(0.95rem, 2vw, 1.05rem)",
              maxWidth: "40ch",
              lineHeight: 1.75,
              fontWeight: 300,
              fontFamily: "var(--font-inter)",
              letterSpacing: "0.01em",
            }}
          >
            {vc.heroSub}
          </p>
        </div>
      </section>

      {/* ── Player ──────────────────────────────────────────────────────── */}
      <section
        id="player"
        style={{
          position: "relative",
          zIndex: 10,
          marginTop: "-60px",
          background: "var(--background)",
          borderRadius: "20px 20px 0 0",
          borderTop: "1px solid var(--border)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
        }}
        className="px-4 md:px-8 py-12 md:py-20"
      >
        <div className="max-w-3xl mx-auto">
          <div className="section-rule" />
          <p
            style={{
              color: "var(--accent)",
              fontSize: "0.6rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              marginBottom: "0.75rem",
              fontWeight: 600,
            }}
          >
            Listen
          </p>
          <h2
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              marginBottom: "0.5rem",
            }}
          >
            Enter your text
          </h2>
          <p
            style={{
              fontSize: "0.8rem",
              marginBottom: "1.5rem",
              color: "var(--accent)",
              fontWeight: 500,
            }}
          >
            First request wakes the GPU (~2 min). Fast after that.
          </p>

          {/* Voice switcher - Large discovery-focused */}
          <div className="flex gap-3 mb-6 flex-col sm:flex-row">
            {VOICES.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setVoice(v.id);
                  handleSpeedChange(VOICE_SPEED_DEFAULTS[v.id]);
                }}
                disabled={isActive}
                aria-pressed={voice === v.id}
                aria-label={`Select ${v.label} voice${voice === v.id ? " (currently selected)" : ""}`}
                className="btn"
                style={{
                  flex: 1,
                  padding: "1.25rem",
                  borderRadius: "10px",
                  border:
                    voice === v.id && !isActive
                      ? "3px solid var(--accent)"
                      : "2px solid var(--border)",
                  background:
                    voice === v.id && !isActive
                      ? "var(--accent)"
                      : "var(--card-bg)",
                  cursor: isActive ? "not-allowed" : "pointer",
                  opacity: isActive ? 0.5 : 1,
                  transition: "all 200ms ease-out",
                  filter: isActive ? "grayscale(80%)" : "none",
                }}
              >
                <div
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: 700,
                    color:
                      voice === v.id && !isActive
                        ? "var(--background)"
                        : "var(--foreground)",
                    fontFamily: "var(--font-playfair)",
                  }}
                >
                  {v.label}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color:
                      voice === v.id && !isActive
                        ? "rgba(255,255,255,0.8)"
                        : "var(--muted)",
                    marginTop: "0.4rem",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {isActive
                    ? "Playing…"
                    : voice === v.id
                      ? "Active"
                      : "Tap to try"}
                </div>
              </button>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            className="textarea-field"
            style={{
              width: "100%",
              background: "var(--card-bg)",
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
            rows={
              typeof window !== "undefined" && window.innerWidth < 640 ? 5 : 7
            }
            maxLength={5000}
            placeholder={vc.textareaPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 5000))}
            disabled={isActive}
          />

          <div className="flex justify-end mt-3 mb-5">
            <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
              {text.length.toLocaleString()} chars
            </span>
          </div>

          {/* Speed */}
          <div className="flex items-center gap-3 mb-5">
            <span
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--muted)",
                whiteSpace: "nowrap",
              }}
            >
              Speed
            </span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={speed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="flex-1"
              style={{ accentColor: "var(--accent)" }}
              aria-label="Playback speed"
              aria-valuetext={`${speed.toFixed(2)}x`}
            />
            <span
              style={{
                color: "var(--accent)",
                fontSize: "0.85rem",
                whiteSpace: "nowrap",
              }}
            >
              {speed.toFixed(2)}&times;
            </span>
          </div>

          {/* Progress */}
          {isActive && (
            <div className="mb-5">
              <div
                style={{
                  height: "1px",
                  background: "var(--border)",
                  borderRadius: "1px",
                  overflow: "hidden",
                }}
              >
                <div
                  className="progress-bar"
                  style={{
                    height: "100%",
                    background: "var(--accent)",
                    width: `${(progress / totalChunks) * 100}%`,
                  }}
                />
              </div>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "0.75rem",
                  marginTop: "0.5rem",
                  textAlign: "center",
                }}
              >
                {status === "loading"
                  ? "Synthesizing…"
                  : status === "paused"
                    ? "Paused"
                    : "Playing…"}{" "}
                &nbsp;{progress} / {totalChunks}
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3">
            {!isActive && (
              <button
                onClick={handlePlay}
                disabled={!text.trim()}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  padding: "0.85rem",
                  background: "var(--foreground)",
                  color: "var(--background)",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                  opacity: text.trim() ? 1 : 0.4,
                  fontFamily: "var(--font-inter)",
                }}
              >
                &#9654; Play
              </button>
            )}
            {isActive && (
              <>
                <button
                  onClick={handlePause}
                  disabled={status === "loading"}
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    padding: "0.85rem",
                    background: "var(--foreground)",
                    color: "var(--background)",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "0.9rem",
                    opacity: status === "loading" ? 0.4 : 1,
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  {status === "paused" ? "▶ Resume" : "⏸ Pause"}
                </button>
                <button
                  onClick={handleStop}
                  className="btn btn-ghost"
                  style={{
                    padding: "0.85rem 1.25rem",
                    background: "transparent",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    fontSize: "0.9rem",
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  &#9632; Stop
                </button>
              </>
            )}
          </div>

          {/* Status messages */}
          {status === "done" && (
            <div
              key="done"
              className="fade-up"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                marginTop: "1rem",
              }}
              role="alert"
              aria-live="polite"
            >
              <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                Finished reading.
              </p>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="btn"
                style={{
                  fontSize: "0.8rem",
                  color: "var(--accent)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "0.35rem 0.85rem",
                  background: "transparent",
                  fontFamily: "var(--font-inter)",
                  opacity: downloading ? 0.5 : 1,
                }}
              >
                {downloading ? "Preparing…" : "↓ Download WAV"}
              </button>
            </div>
          )}
          {status === "error" && (
            <p
              key="error"
              className="fade-up"
              style={{
                textAlign: "center",
                color: "#C0392B",
                fontSize: "0.85rem",
                marginTop: "1rem",
              }}
              role="alert"
              aria-live="assertive"
            >
              Synthesis failed. Check your connection and try again.
            </p>
          )}
        </div>
      </section>

      {/* ── Compare ─────────────────────────────────────────────────────── */}
      {voice === "osho" && (
        <section
          style={{ borderTop: "1px solid var(--border)" }}
          className="px-4 md:px-8 py-12 md:py-20"
        >
          <div className="max-w-5xl mx-auto">
            <p
              style={{
                color: "var(--accent)",
                fontSize: "0.6rem",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                marginBottom: "0.75rem",
                fontWeight: 600,
              }}
            >
              Compare
            </p>
            <h2
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "clamp(1.6rem, 4vw, 2rem)",
                fontWeight: 400,
                marginBottom: "0.5rem",
              }}
            >
              Real vs AI
            </h2>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.85rem",
                fontWeight: 300,
                marginBottom: "2rem",
              }}
            >
              Same sentence — once from the original recording, once from the AI
              clone.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                className="card-lift"
                style={{
                  background: "var(--card-bg)",
                  borderRadius: "6px",
                  padding: "1.25rem",
                }}
              >
                <p
                  style={{
                    fontSize: "0.7rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    marginBottom: "0.75rem",
                  }}
                >
                  Original Voice
                </p>
                {voice === "osho" ? (
                  <>
                    <p
                      style={{
                        fontFamily: "var(--font-playfair)",
                        fontStyle: "italic",
                        fontSize: "0.9rem",
                        lineHeight: 1.6,
                        marginBottom: "1.25rem",
                      }}
                    >
                      &ldquo;It is the mind that has been trained into
                      Aristotelian logic.&rdquo;
                    </p>
                    <audio
                      controls
                      src="/osho_real.wav"
                      style={{ width: "100%" }}
                    />
                  </>
                ) : (
                  <>
                    <p
                      style={{
                        fontFamily: "var(--font-playfair)",
                        fontStyle: "italic",
                        fontSize: "0.9rem",
                        lineHeight: 1.6,
                        marginBottom: "1.25rem",
                      }}
                    >
                      &ldquo;How did the universe begin? We&apos;ve all heard of
                      the Big Bang, but how do we really know that&apos;s the
                      way it was?&rdquo;
                    </p>
                    <audio
                      controls
                      src="/morgan_real.wav"
                      style={{ width: "100%" }}
                    />
                  </>
                )}
              </div>
              <CompareAI voice={voice} />
            </div>
          </div>
        </section>
      )}

      {/* ── Process ─────────────────────────────────────────────────────── */}
      <section
        id="process"
        style={{ borderTop: "1px solid var(--border)" }}
        className="px-4 md:px-8 py-12 md:py-20"
      >
        <div className="max-w-5xl mx-auto">
          <p
            style={{
              color: "var(--accent)",
              fontSize: "0.6rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              marginBottom: "0.75rem",
              fontWeight: 600,
            }}
          >
            Process
          </p>
          <h2
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "clamp(1.6rem, 4vw, 2rem)",
              fontWeight: 400,
              marginBottom: "0.5rem",
            }}
          >
            How it was built
          </h2>
          <p
            style={{
              color: "var(--muted)",
              fontSize: "0.85rem",
              fontWeight: 300,
              marginBottom: "3rem",
              maxWidth: "52ch",
              lineHeight: 1.7,
            }}
          >
            {vc.processSubtitle}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {vc.steps.map((step) => (
              <div
                key={step.num}
                className="card-lift"
                style={{
                  background: "var(--card-bg)",
                  borderRadius: "10px",
                  padding: "1.75rem",
                  borderLeft: "3px solid var(--accent)",
                  border: "1px solid var(--border)",
                  borderLeftWidth: "3px",
                  borderLeftColor: "var(--accent)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-playfair)",
                    fontSize: "2rem",
                    color: "var(--accent)",
                    opacity: 0.4,
                    lineHeight: 1,
                    marginBottom: "1rem",
                  }}
                >
                  {step.num}
                </p>
                <h3
                  style={{
                    fontFamily: "var(--font-playfair)",
                    fontSize: "1.05rem",
                    fontWeight: 500,
                    marginBottom: "0.75rem",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.85rem",
                    lineHeight: 1.8,
                    fontWeight: 300,
                  }}
                >
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quote ───────────────────────────────────────────────────────── */}
      <section
        style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          background: "var(--card-bg)",
          position: "relative",
          overflow: "hidden",
        }}
        className="px-4 md:px-8 py-16 md:py-24"
      >
        {/* Giant decorative quote mark */}
        <div
          aria-hidden="true"
          role="presentation"
          style={{
            position: "absolute",
            top: "-0.5rem",
            left: "1.5rem",
            fontFamily: "var(--font-playfair)",
            fontSize: "clamp(12rem, 25vw, 22rem)",
            lineHeight: 1,
            color: "var(--accent)",
            opacity: 0.06,
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          &ldquo;
        </div>
        <div
          className="max-w-5xl mx-auto"
          style={{ position: "relative", zIndex: 1 }}
        >
          <blockquote
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "clamp(1.2rem, 3.5vw, 2rem)",
              fontWeight: 400,
              lineHeight: 1.5,
              fontStyle: "italic",
              maxWidth: "38ch",
            }}
          >
            &ldquo;{quote}&rdquo;
          </blockquote>
          <p
            style={{
              color: "var(--accent)",
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginTop: "1.5rem",
              fontWeight: 500,
            }}
          >
            {vc.attribution}
          </p>
        </div>
      </section>

      {/* ── About ───────────────────────────────────────────────────────── */}
      <section
        id="about"
        className="px-4 md:px-8 py-12 md:py-20"
        style={{ background: "var(--background)" }}
      >
        <div
          className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16"
          style={{
            background: "var(--card-bg)",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            padding: "2.5rem",
          }}
        >
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {voice === "morgan" ? (
              <div
                style={{
                  width: 140,
                  height: 140,
                  flexShrink: 0,
                  borderRadius: "4px",
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2.5rem",
                  color: "var(--accent)",
                  fontFamily: "var(--font-playfair)",
                }}
              >
                MF
              </div>
            ) : (
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
            )}
            <div>
              <p
                style={{
                  color: "var(--accent)",
                  fontSize: "0.7rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: "0.75rem",
                }}
              >
                About
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontSize: "clamp(1.5rem, 4vw, 2rem)",
                  fontWeight: 400,
                  lineHeight: 1.2,
                  marginBottom: "1rem",
                }}
              >
                {vc.aboutName}
              </h2>
              <p
                style={{
                  color: "var(--muted)",
                  lineHeight: 1.8,
                  fontWeight: 300,
                  fontSize: "0.95rem",
                }}
              >
                {vc.aboutBio}
              </p>
            </div>
          </div>
          <div
            className="md:border-l md:pl-8"
            style={{ borderColor: "var(--border)" }}
          >
            <p
              style={{
                color: "var(--accent)",
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginBottom: "0.75rem",
              }}
            >
              This Project
            </p>
            <h2
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "clamp(1.5rem, 4vw, 2rem)",
                fontWeight: 400,
                lineHeight: 1.2,
                marginBottom: "1rem",
              }}
            >
              How it works
            </h2>
            <p
              style={{
                color: "var(--muted)",
                lineHeight: 1.8,
                fontWeight: 300,
                fontSize: "0.95rem",
              }}
            >
              {vc.howItWorksBody}
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer
        style={{ borderTop: "1px solid var(--border)" }}
        className="px-4 md:px-8 py-6"
      >
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <span
            style={{ fontFamily: "var(--font-playfair)", fontSize: "0.95rem" }}
          >
            {vc.brand}
          </span>
        </div>
      </footer>
    </main>
  );
}
