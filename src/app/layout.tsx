import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Story to Video Studio',
  description: 'Turn your story into motion',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
