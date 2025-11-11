import "./globals.css";

export const metadata = {
  title: "Stu Portfolio Chat",
  description: "Ask about Stu’s background, projects, and strengths.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">{children}</body>
    </html>
  );
}
