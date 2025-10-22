import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ODARK - AI Asisten Operasional Z.ai",
  description: "ODARK adalah AI asisten internal Z.ai yang elegan, ramah, dan operasional dengan tema hitam-kuning futuristik.",
  keywords: ["ODARK", "Z.ai", "AI Assistant", "Operasional", "Chatbot", "Next.js", "TypeScript"],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "ODARK - AI Asisten Operasional",
    description: "AI asisten internal Z.ai yang elegan dan operasional",
    url: "https://chat.z.ai",
    siteName: "ODARK by Z.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ODARK - AI Asisten Operasional",
    description: "AI asisten internal Z.ai yang elegan dan operasional",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-yellow-400`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
