import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";

const font = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trip Planner",
  description: "Plan trips with friends / วางแผนเที่ยวกับเพื่อน",
};

// ถ้าเคยเลือกโหมดไว้ใช้ตามนั้น ไม่งั้นตามโหมดของเครื่อง
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={font.className}>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}