import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "주말패스 성과 대시보드",
  description: "주말패스 이니셔티브 성과 및 현황 트래킹",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
