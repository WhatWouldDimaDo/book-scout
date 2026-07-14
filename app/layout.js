import { Special_Elite, DM_Sans, Courier_Prime } from "next/font/google";
import "./globals.css";

const specialElite = Special_Elite({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const courierPrime = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://deweybooks.vercel.app"),
  title: "Dewey",
  description: "Find your next read on a Fulton County shelf",
  openGraph: {
    title: "Dewey",
    description: "Find your next read on a Fulton County shelf",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dewey",
    description: "Find your next read on a Fulton County shelf",
  },
};

export const viewport = {
  themeColor: "#f4eede",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${specialElite.variable} ${dmSans.variable} ${courierPrime.variable}`}>
        {children}
      </body>
    </html>
  );
}
