export const metadata = {
  title: "Stu Portfolio Chat",
  description: "Ask about Stu’s background, projects, and strengths.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
