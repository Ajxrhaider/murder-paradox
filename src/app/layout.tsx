import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Murder Paradox — Two truths. One lie.",
  description:
    "Interrogate three witnesses, compare their testimony, and solve the Orchid House murder.",
  applicationName: "Murder Paradox",
  category: "games",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
