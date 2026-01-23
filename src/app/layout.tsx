import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/Providers";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FairShare - Smart Bill Splitting",
  description: "Split bills fairly with roommates. Upload receipts, select items, and calculate who owes what.",
  keywords: ["bill splitting", "roommates", "expense sharing", "receipt scanner"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased min-h-screen bg-zinc-950`}
      >
        <div className="relative min-h-screen">
          {/* Background gradient */}
          <div className="fixed inset-0 bg-gradient-to-br from-emerald-950/20 via-zinc-950 to-zinc-950 pointer-events-none" />
          <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
          
          {/* Content */}
          <div className="relative z-10">
            <Providers>
              {children}
            </Providers>
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
