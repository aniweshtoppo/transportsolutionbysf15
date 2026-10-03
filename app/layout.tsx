import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal Mobility Desk",
  description: "Campus Toto & E-Rickshaw Management Desk",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased text-gray-900 bg-gray-50">{children}</body>
    </html>
  );
}
