import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";



export const metadata: Metadata = {
  title: "CareConnect - Patient Monitoring",
  description: "Real-time patient safety and caretaker monitoring platform",
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
