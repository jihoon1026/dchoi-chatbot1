import type { Metadata, Viewport } from "next";
import { EB_Garamond, JetBrains_Mono, Noto_Sans_KR, Noto_Serif_KR, Saira_Condensed } from "next/font/google";
import "./globals.css";

// DESIGN.md 의 세 가지 글꼴 역할 (대체 글꼴 + 한글 글꼴)
//  Display(제목) → Saira Condensed + Noto Sans KR
//  Text(본문)    → EB Garamond + Noto Serif KR
//  Monospace(버튼·캡션·메뉴) → JetBrains Mono + Noto Sans KR
const display = Saira_Condensed({ weight: "400", subsets: ["latin"], variable: "--font-display-latin" });
const text = EB_Garamond({ subsets: ["latin"], variable: "--font-text-latin" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-latin" });
const sansKr = Noto_Sans_KR({ weight: "400", subsets: ["latin"], preload: false, variable: "--font-sans-kr" });
const serifKr = Noto_Serif_KR({ weight: "400", subsets: ["latin"], preload: false, variable: "--font-serif-kr" });

export const metadata: Metadata = {
  title: "DCHOI09 · 전집 상담",
  description: "dchoi09.com 전집 상담 챗봇",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={[display, text, mono, sansKr, serifKr].map((f) => f.variable).join(" ")}
    >
      <body>{children}</body>
    </html>
  );
}
