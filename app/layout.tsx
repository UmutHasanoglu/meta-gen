import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stock Image Metadata Generator",
  description: "Generate titles, descriptions, and keywords for stock images using AI. Supports OpenAI and Gemini models with CSV export for Adobe Stock, Shutterstock, Vecteezy, Freepik, and Dreamstime.",
  keywords: ["stock photography", "metadata generator", "AI", "keywords", "SEO", "Adobe Stock", "Shutterstock"],
  authors: [{ name: "Meta-Gen" }],
  openGraph: {
    title: "Stock Image Metadata Generator",
    description: "Generate AI-powered titles, descriptions, and keywords for your stock images. Export to major marketplaces.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stock Image Metadata Generator",
    description: "Generate AI-powered titles, descriptions, and keywords for your stock images.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-neutral-950 text-neutral-100 antialiased font-sans`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
