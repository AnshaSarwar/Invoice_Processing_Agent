import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'InvoSync AI - Secured',
  description: 'Intelligent Invoice Automation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased min-h-screen`}>
        <div className="relative flex flex-col min-h-screen">
          <main className="flex-grow flex flex-col">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
