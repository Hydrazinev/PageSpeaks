import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "PageSpeaks — Hear Any Text in Multiple Voices",
  description:
    "PageSpeaks brings text to life with AI voice clones of multiple speakers. Fine-tuned on thousands of hours of real audio.",
  metadataBase: new URL("https://pagespeaks.vercel.app"),
  canonical: "https://pagespeaks.vercel.app",
  openGraph: {
    title: "PageSpeaks — Hear Any Text in Multiple Voices",
    description:
      "Paste text and hear it read aloud in the voices of famous speakers like Osho and Morgan Freeman.",
    url: "https://pagespeaks.vercel.app",
    image: "/osho.png",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body data-voice="osho">{children}</body>
    </html>
  );
}
