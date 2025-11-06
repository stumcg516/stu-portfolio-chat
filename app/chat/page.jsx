"use client";

import { useEffect, useRef, useState } from "react";

// Lightweight bubble
function Bubble({ role, children }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} w-full`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed shadow
          ${isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}
      >
        {children}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState([]); // {role, content, sources?}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  // autoscroll to last message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(e) {
    e?.preventDefault?.();
    const question = input.trim();
    if (!question || loading) return;

    // push user message
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });

      // Prepare an empty assistant message we can stream into
      let assistantIndex;
      setMessages((prev) => {
        assistantIndex = prev.length;
        return [...prev, { role: "assistant", content: "" }];
      });

      // Try streaming first (e.g., text/plain or text/event-stream)
      const ct = res.headers.get("content-type") || "";
      if (res.body && (ct.includes("text") || ct.includes("event-stream"))) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        while (!done) {
          const { value, done: d } = await reader.read();
          done = d;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            setMessages((prev) => {
              const copy = [...prev];
              copy[assistantIndex] = {
                ...copy[assistantIndex],
                content: (copy[assistantIndex].content || "") + chunk,
              };
              return copy;
            });
          }
        }
      } else {
        // Fallback to JSON shape: { answer: string, sources?: [] }
        const data = await res.json().catch(() => ({}));
        const text =
          typeof data?.answer === "string"
            ? data.answer
            : (await res.text?.()) || "⚠️ No response.";
        setMessages((prev) => {
          const copy = [...prev];
          copy[assistantIndex] = {
            role: "assistant",
            content: text,
            sources: data?.sources || [],
          };
          return copy;
        });
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err?.message || err}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Enter to send, Shift+Enter for newline
  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      send(e);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto flex max-w-3xl flex-col px-4 py-6">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">💬 Stu’s Portfolio Chat</h1>
          <a
            href="/"
            className="text-sm text-blue-600 hover:underline"
            aria-label="Go home"
          >
            Home
          </a>
        </header>

        <section className="flex-1 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-3 h-[60vh] overflow-y-auto space-y-3 pr-1">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-20">
                Ask about Stu’s background, strengths, and projects.
                <br />
                Examples: “Who is Stu McGibbon?” • “What are Stu’s strengths as a designer?”
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className="space-y-1">
                <Bubble role={m.role}>{m.content}</Bubble>
                {m.sources?.length ? (
                  <div className="ml-2 text-xs text-gray-500">
                    Sources:{" "}
                    {m.sources.map((s, j) => (
                      <span key={j} className="mr-2">
                        {s.source || s.id || `#${j + 1}`}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {loading && (
              <div className="text-xs italic text-gray-400">Thinking…</div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
              className="flex-1 resize-none rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
