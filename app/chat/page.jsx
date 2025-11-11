"use client";

import { useEffect, useRef, useState } from "react";

// Simple message shape
function Bubble({ role, content, onCopy }) {
  const isUser = role === "user";
  return (
    <div className={`msg ${isUser ? "user" : "bot"}`}>
      <div className="avatar">{isUser ? "🧑‍💻" : "🤖"}</div>
      <div className="bubble">
        <div className="content">{content}</div>
        {!isUser && (
          <button className="copy" onClick={onCopy} title="Copy answer">
            ⧉
          </button>
        )}
      </div>
      <style jsx>{`
        .msg {
          display: grid;
          grid-template-columns: 36px 1fr;
          gap: 10px;
          align-items: flex-start;
          margin-bottom: 14px;
        }
        .avatar {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: var(--card);
          box-shadow: var(--shadow);
          font-size: 18px;
        }
        .bubble {
          position: relative;
          background: ${isUser ? "var(--user)" : "var(--card)"};
          color: ${isUser ? "var(--userText)" : "inherit"};
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          border-radius: 14px;
          box-shadow: var(--shadow);
        }
        .content {
          white-space: pre-wrap;
          word-break: break-word;
        }
        .copy {
          position: absolute;
          right: 8px;
          bottom: 8px;
          border: 0;
          background: transparent;
          cursor: pointer;
          opacity: 0.6;
        }
        .copy:hover {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I’m the concierge for Stu’s portfolio. Ask about projects, strengths, or anything on this site.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const abortRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text) {
    const user = { role: "user", content: text.trim() };
    const assistant = { role: "assistant", content: "" };
    setMessages((m) => [...m, user, assistant]);
    setLoading(true);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value);
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              content: copy[copy.length - 1].content + chunk,
            };
            return copy;
          });
        }
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry — I hit an error. Try again in a moment." },
      ]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input;
    setInput("");
    sendMessage(text);
  }

  function onStop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  function quickAsk(q) {
    setInput(q);
    // tiny delay so input renders before submit
    setTimeout(() => {
      const form = document.getElementById("chat-form");
      form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }, 0);
  }

  return (
    <main className="wrap">
      <header className="header">
        <div className="title">
          <span className="logo">💬</span> Stu’s Portfolio Chat
        </div>
        <a className="home" href="/">Home</a>
      </header>

      <section className="panel">
        <div className="hints">
          <span className="hint-label">Try:</span>
          <button onClick={() => quickAsk("Who is Stu McGibbon?")}>Who is Stu McGibbon?</button>
          <button onClick={() => quickAsk("What are Stu’s strengths as a designer?")}>
            Strengths
          </button>
          <button onClick={() => quickAsk("Tell me about a project Stu led end-to-end.")}>
            Project overview
          </button>
        </div>

        <div className="messages" ref={listRef}>
          {messages.map((m, i) => (
            <Bubble
              key={i}
              role={m.role}
              content={m.content}
              onCopy={() => navigator.clipboard.writeText(m.content)}
            />
          ))}
          {loading && (
            <div className="typing">
              <div className="dot" />
              <div className="dot" />
              <div className="dot" />
            </div>
          )}
        </div>

        <form id="chat-form" className="composer" onSubmit={onSubmit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement)?.requestSubmit();
              }
            }}
          />
          <div className="actions">
            {loading ? (
              <button type="button" className="secondary" onClick={onStop}>
                Stop
              </button>
            ) : (
              <button type="submit">Send</button>
            )}
          </div>
        </form>
      </section>

      <style jsx>{`
        :root {
          --bg: #0b0c0f;
          --fg: #e9eef6;
          --muted: #98a2b3;
          --card: rgba(255, 255, 255, 0.06);
          --hairline: rgba(255, 255, 255, 0.12);
          --user: #2563eb;
          --userText: #ffffff;
          --shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          --focus: 0 0 0 3px rgba(37, 99, 235, 0.35);
        }
        @media (prefers-color-scheme: light) {
          :root {
            --bg: #f6f7fb;
            --fg: #0b1220;
            --muted: #5b6473;
            --card: #ffffff;
            --hairline: rgba(19, 29, 52, 0.08);
            --user: #2563eb;
            --userText: #ffffff;
            --shadow: 0 8px 24px rgba(12, 22, 44, 0.08);
          }
        }
        * { box-sizing: border-box; }
        html, body, .wrap { height: 100%; }
        body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.45 system-ui, -apple-system, Segoe UI, Roboto, Arial; }

        .wrap {
          max-width: 900px;
          margin: 0 auto;
          padding: 28px 16px 22px;
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 18px;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .title {
          font-weight: 700;
          font-size: 22px;
          letter-spacing: 0.3px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: var(--card);
          box-shadow: var(--shadow);
        }
        .home {
          color: var(--muted);
          text-decoration: none;
          border: 1px solid var(--hairline);
          padding: 8px 10px;
          border-radius: 10px;
          background: var(--card);
        }
        .home:hover { color: var(--fg); }

        .panel {
          display: grid;
          grid-template-rows: auto 1fr auto;
          gap: 12px;
          background: var(--card);
          border: 1px solid var(--hairline);
          border-radius: 16px;
          box-shadow: var(--shadow);
          overflow: hidden;
        }

        .hints {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding: 12px 12px 0;
        }
        .hint-label {
          color: var(--muted);
          margin-right: 4px;
          align-self: center;
        }
        .hints button {
          border: 1px solid var(--hairline);
          background: transparent;
          color: var(--fg);
          border-radius: 999px;
          padding: 6px 10px;
          cursor: pointer;
        }
        .hints button:hover {
          background: rgba(255,255,255,0.06);
        }

        .messages {
          padding: 14px 14px 6px;
          overflow: auto;
          min-height: 280px;
          max-height: calc(100vh - 280px);
        }

        .composer {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          padding: 12px;
          border-top: 1px solid var(--hairline);
          background: linear-gradient(180deg, transparent, rgba(0,0,0,0.03));
        }
        .composer input {
          width: 100%;
          resize: none;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid var(--hairline);
          background: #ffffff0d;
          color: var(--fg);
          outline: none;
        }
        .composer input:focus { box-shadow: var(--focus); }
        .actions {
          display: flex; gap: 8px;
        }
        button {
          border: 0;
          background: var(--user);
          color: #fff;
          padding: 12px 14px;
          border-radius: 12px;
          cursor: pointer;
          box-shadow: var(--shadow);
        }
        button.secondary {
          background: #6b7280;
        }
        button:disabled { opacity: 0.6; cursor: not-allowed; }

        .typing {
          display: flex;
          gap: 6px;
          padding: 10px 14px 18px;
        }
        .dot {
          width: 8px; height: 8px; border-radius: 999px; background: var(--muted);
          animation: bounce 1s infinite ease-in-out;
        }
        .dot:nth-child(2) { animation-delay: 0.15s }
        .dot:nth-child(3) { animation-delay: 0.3s }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </main>
  );
}
