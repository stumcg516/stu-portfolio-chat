import "./globals.css";

export const metadata = {
  title: "Stu Portfolio Chat",
  description: "Ask about Stu’s background, projects, and strengths.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-text antialiased flex flex-col">
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
