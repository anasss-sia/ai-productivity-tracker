import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Productivity Tracker",
  description: "Веб-приложение для задач, фокус-сессий, аналитики и AI-рекомендаций",
  icons: {
    icon: "/logo-option-2.png",
    apple: "/logo-option-2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
