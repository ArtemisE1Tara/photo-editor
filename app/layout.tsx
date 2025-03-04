import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GoogleAuthProvider } from "@/components/google-auth-provider";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PixelVault - Photo Editor with Google Drive Integration",
  description: "Edit your photos and save them directly to Google Drive",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="google-signin-client_id" content={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID} />
        <meta
          httpEquiv="Content-Security-Policy"
          content="script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://accounts.google.com;"
        />
      </head>
      <body className={inter.className}>
        <GoogleAuthProvider>
          {children}
          <Toaster />
        </GoogleAuthProvider>
      </body>
    </html>
  );
}