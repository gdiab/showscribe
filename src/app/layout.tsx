import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://showscribe.vercel.app'),
  title: 'ShowScribe - AI-Powered Podcast Show Notes Generator',
  description:
    'Transform your podcast episodes into professional show notes, summaries, highlights, guest bios, and social media content using AI. Upload audio and get comprehensive content in minutes.',
  keywords: ['podcast', 'show notes', 'AI', 'transcription', 'content generation', 'social media'],
  authors: [{ name: 'ShowScribe' }],
  icons: {
    icon: '/logos/icononly_nobuffer.png',
    shortcut: '/logos/icononly_nobuffer.png',
    apple: '/logos/icononly_nobuffer.png',
  },
  openGraph: {
    title: 'ShowScribe - AI-Powered Podcast Show Notes Generator',
    description:
      'Transform your podcast episodes into professional show notes, summaries, highlights, guest bios, and social media content using AI.',
    url: 'https://showscribe.vercel.app',
    siteName: 'ShowScribe',
    images: [
      {
        url: '/og-logo.png',
        width: 1200,
        height: 630,
        alt: 'ShowScribe - AI-Powered Podcast Show Notes Generator',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShowScribe - AI-Powered Podcast Show Notes Generator',
    description:
      'Transform your podcast episodes into professional show notes using AI. Upload audio and get comprehensive content in minutes.',
    images: ['/og-logo.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
