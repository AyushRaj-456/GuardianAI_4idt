import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";



export const metadata: Metadata = {
  title: "Guardian AI - Patient Monitoring",
  description: "Real-time patient safety and caretaker monitoring platform",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased bg-gray-50 text-gray-900`}
        suppressHydrationWarning
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
