import type { Metadata } from "next";
import { involve, anticva } from "@/lib/fonts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { mainSiteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: "Хорарная астрология — ответ на вопрос по карте момента | Astro AI",
  description:
    "Задайте вопрос и получите ответ по хорарной карте, построенной на момент вопроса. Толкование опирается на классические книги по хорарной астрологии.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const mainSite = mainSiteUrl();

  return (
    <html lang="ru" className={`${involve.variable} ${anticva.variable}`}>
      <body>
        <div className="page-stars" aria-hidden="true" />
        <Header mainSite={mainSite} />
        <main style={{ paddingTop: 112 }}>{children}</main>
        <Footer mainSite={mainSite} />
      </body>
    </html>
  );
}
