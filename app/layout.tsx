import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "一脚踢出圈｜闽超声浪接力",
  description: "以互动仪式链为主线的闽超像素风互动 H5：听故事、选符号、找同伴、做二创、传感器射门并分享作品。",
  openGraph: {
    title: "一脚踢出圈｜闽超声浪接力",
    description: "听故事、选符号、找同伴、做二创，再把闽超一脚踢出屏幕。",
    images: [{ url: "/og.png", width: 1774, height: 887, alt: "一脚踢出圈，闽超声浪接力" }],
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "一脚踢出圈｜闽超声浪接力",
    description: "把一场比赛变成愿意被继续讲述的城市记忆。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/assets/guide.png",
    shortcut: "/assets/guide.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a4a32",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
