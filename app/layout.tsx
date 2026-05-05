import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AlertToaster } from "@/components/layout/AlertToaster";
import { AppShell } from "@/components/layout/AppShell";

const geistSans = localFont({ src: "./fonts/GeistVF.woff", variable: "--font-sans", weight: "100 900" });
const geistMono = localFont({ src: "./fonts/GeistMonoVF.woff", variable: "--font-mono", weight: "100 900" });

export const metadata: Metadata = {
  title: "污水托管运营平台",
  description: "乡镇污水站智能托管 SaaS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('ww-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(_){}` }} />
      </head>
      <body className="antialiased bg-background text-foreground">
        <TooltipProvider>
          <AppShell>{children}</AppShell>
          <AlertToaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
