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
  title: "Dewey — Find Fulton County Library Books on the Shelf",
  description:
    "Paste a reading list or ask for recommendations. Dewey checks the Fulton County Library catalog for live availability and call numbers at your branch.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Dewey — Find Books on a Fulton County Library Shelf",
    description:
      "Paste a reading list or ask for recommendations, then see live availability and call numbers for your Fulton County branch.",
    url: "/",
    siteName: "Dewey",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Dewey checks reading lists against live Fulton County Library shelf availability",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dewey — Find Books on a Fulton County Library Shelf",
    description:
      "Paste a reading list or ask for recommendations, then see live availability and call numbers for your Fulton County branch.",
    images: ["/opengraph-image.png"],
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
