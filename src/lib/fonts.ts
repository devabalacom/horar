import localFont from "next/font/local";

export const involve = localFont({
  src: [
    { path: "../fonts/Involve-Regular.otf", weight: "400", style: "normal" },
    { path: "../fonts/Involve-Medium.otf", weight: "500", style: "normal" },
    { path: "../fonts/Involve-SemiBold.otf", weight: "700", style: "normal" },
    { path: "../fonts/Involve-Bold.otf", weight: "900", style: "normal" },
  ],
  variable: "--font-involve",
  display: "swap",
});

export const anticva = localFont({
  src: [{ path: "../fonts/Anticva-Regular.otf", weight: "400", style: "normal" }],
  variable: "--font-anticva",
  display: "swap",
});
