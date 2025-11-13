"use client";

import { useEffect, useRef, useState } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function BotAvatar() {
  return (
    <div className="h-8 w-8 rounded-full bg-sky-100 text-sky-700 grid place-items-center text-sm">
      🤖
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="h-8 w-8 rounded-full bg-zinc-100 text-zinc-700 grid place-items-center text-sm">
      🧑
    </div>
  );
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-zinc-400 hover:text-zinc-600 transition"
      title="Copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text || "");
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // ignore
        }
      }}
    >
      {copied ? "✔︎" : "⎘"}
    </button>
  );
}

function Sources({ items }) {
  if (!items || !items.length) return null;
  return (
    <div className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 leading-relaxed">
      <div className="font-medium text-zinc-700 mb-1">Sources</div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((s, i) => (
          <li key={i} className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-300" />
            <span className="tabular-nums">
              {s.source ?? s.id ?? "source"}{" "}
              {typeof s.score === "number" ? (
                <span className="text-zinc-400">({s.score.toFixed(2)})</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Message bubble with optional "typing" reveal animation
 */
function Message({ role, content, sources, animate }) {
  const isUser = role === "user";

  // show full text immediately for user messages
  const [displayText, setDisplayText] = useState(
    animate && !isUser ? "" : content
  );
  const [done, setDone] = useState(!animate || isUser);

  useEffect(() => {
    if (isUser) {
      setDisplayText(content);
      setDone(true);
      return;
    }

    if (!animate) {
      setDisplayText(content);
      setDone(true);
      return;
    }

    const full = content || "";
    setDisplayText("");
    setDone(false);

    // ChatGPT-ish pace: ~25ms / character (auto-faster for very long texts)
    const baseDelay = 18;
    const len = full.length || 1;
    const delay = len > 800 ? 6 : len > 400 ? 10 : baseDelay;

    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplayText(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(id);
        setDone(true);
      }
    }, delay);

    return () => clearInterval(id);
  }, [content, animate, isUser]);

  return (
    <div
      className={cx(
        "flex items-start gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && <BotAvatar />}
      <div
        className={cx(
          "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-black text-white rounded-tr-sm"
            : "bg-white text-zinc-900 ring-1 ring-zinc-100 rounded-tl-sm"
        )}
      >
        <div className="whitespace-pre-wrap leading-relaxed">
          {displayText}
        </div>
        {/* only show sources once the typing animation is done */}
        {!isUser && done && <Sources items={sources} />}
      </div>
      {isUser && <UserAvatar />}
      {/* copy button only when assistant text is fully revealed */}
      {!isUser && done && (
        <div className="pl-2 pt-1">
          <CopyBtn text={content} />
        </div>
      )}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-3">
      <BotAvatar />
      <div className="inline-flex items-center rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-100">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 animate-pulse [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-200 animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

const WELCOME =
  "Hi! I’m the concierge for Stu’s portfolio. Ask about projects, strengths, or anything on this site.";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  // animate the initial welcome message on mount
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: WELCOME,
        sources: [],
        animate: true,
      },
    ]);
  }, []);

  // Auto-scroll to latest
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  async function sendMessage(explicitQuestion) {
    const q = (explicitQuestion ?? input).trim();
    if (!q) return;

    // history to send to backend (role/content only)
    const historyForServer = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // add user message locally
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          history: historyForServer,
        }),
      });

      const data = await res.json();
      const text =
        typeof data?.answer === "string"
          ? data.answer
          : typeof data === "string"
          ? data
          : JSON.stringify(data, null, 2);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: text,
          sources: data?.sources || [],
          animate: true, // trigger typing effect for this reply
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry—something went wrong while contacting the chat endpoint.",
          sources: [],
          animate: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="mr-2">💬</span>Stu’s Portfolio Chat
          </h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-zinc-600">
            <span className="shrink-0">Try:</span>
            <button
              className="underline-offset-2 hover:underline"
              onClick={() => sendMessage("Who is Stu McGibbon?")}
            >
              Who is Stu McGibbon?
            </button>
            <button
              className="underline-offset-2 hover:underline"
              onClick={() => sendMessage("What are Stu’s strengths?")}
            >
              Strengths
            </button>
            <button
              className="underline-offset-2 hover:underline"
              onClick={() => sendMessage("Give me a project overview.")}
            >
              Project overview
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        <div
          ref={listRef}
          className="mt-6 mb-32 flex flex-col gap-5 overflow-y-auto"
          style={{ minHeight: "40vh" }}
        >
          {messages.map((m, i) => (
            <Message
              key={i}
              role={m.role}
              content={m.content}
              sources={m.sources}
              // only animate the most recent assistant message
              animate={!!m.animate && i === messages.length - 1}
            />
          ))}
          {loading && <TypingBubble />}
        </div>

        {/* input bar */}
        <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 py-3">
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <input
                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 pr-24 shadow-sm outline-none focus:border-zinc-400 focus:ring-0 placeholder:text-zinc-400"
                placeholder="Ask a question…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const form = e.currentTarget.form;
                    if (form?.requestSubmit) {
                      form.requestSubmit();
                    } else {
                      form?.dispatchEvent(
                        new Event("submit", {
                          cancelable: true,
                          bubbles: true,
                        })
                      );
                    }
                  }
                }}
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
                disabled={!input.trim() || loading}
              >
                Send
              </button>
            </form>
            <div className="h-2" />
          </div>
        </div>
      </main>
    </div>
  );
}
