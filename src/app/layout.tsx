import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://twoframes.app"),
  title: "TwoFrames — Premium Private Space for Couples",
  description: "A beautiful, private digital sanctuary for couples. Share one daily memory, track moods in real-time, and preserve your relationship timeline.",
  keywords: ["couples app", "private sharing", "relationship timeline", "couple diary", "mood tracker", "daily memory"],
  authors: [{ name: "TwoFrames Team" }],
  openGraph: {
    title: "TwoFrames — Premium Private Space for Couples",
    description: "A beautiful, private digital sanctuary for couples. Share one daily memory, track moods in real-time, and preserve your relationship timeline.",
    url: "https://twoframes.app",
    siteName: "TwoFrames",
    images: [
      {
        url: "/og-preview.png",
        width: 1200,
        height: 630,
        alt: "TwoFrames App Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TwoFrames — Premium Private Space for Couples",
    description: "A beautiful, private digital sanctuary for couples. Share one daily memory, track moods in real-time, and preserve your relationship timeline.",
    images: ["/og-preview.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#0f0a1a] text-white">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
