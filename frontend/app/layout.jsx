import "./globals.css";

export const metadata = {
  title: "誰是臥底？人類 vs AI 心理戰",
  description: "多人連線心理戰網頁遊戲，採用 Next.js、Express、Socket.io 與 Gemini API。"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
