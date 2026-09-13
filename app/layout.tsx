import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Tire Store Tracker',
  description: 'Motorcycle tire market / store tier / brand distribution tracker',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="bg-white border-b px-4 py-3 flex gap-4 items-center sticky top-0 z-10">
          <a href="/" className="font-semibold">📊 Dashboard</a>
          <a href="/stores" className="text-sm text-gray-600 hover:text-black">Stores</a>
          <a href="/entry" className="text-sm text-gray-600 hover:text-black">+ New Entry</a>
        </nav>
        <main className="p-4 max-w-6xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
