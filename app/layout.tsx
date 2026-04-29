import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

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
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-slate-50 text-slate-900">
        <TooltipProvider>
          <div className="flex h-screen overflow-hidden bg-[#EEF0F5]">
            <Sidebar />
            <main className="flex-1 overflow-y-auto pt-12 md:pt-0">{children}</main>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
