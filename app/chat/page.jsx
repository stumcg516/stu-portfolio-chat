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
        } catch {}
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

function Message({ role, content, sources }) {
  const isUser = role === "user";
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
        <div className="whitespace-pre-wrap leading-relaxed">{content}</div>
        {!isUser && <Sources items={sources} />}
      </div>
      {isUser && <UserAvatar />}
      {!isUser && (
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
      <div className="max-w-[80%] rounded-2xl bg-white text-zinc-900 ring-1 ring-zinc-100 rounded-tl-sm px-4 py-3 shadow-sm">
        <span className="inline-flex items-center h-4">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </span>
      </div>
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

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  function trimmedHistory(max = 8) {
    // send the last few messages (role + content only)
    return messages.slice(-max).map(({ role, content }) => ({ role, content }));
  }

  async function sendMessage(question) {
    const q = question?.trim?.() ?? input.trim();
    if (!q) return;

    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");

    const assistantIndex = messages.length + 1;
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          history: messages,   // 👈 send the full chat history
        }),
      });

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        const text =
          typeof data?.answer === "string"
            ? data.answer
            : typeof data === "string"
            ? data
            : JSON.stringify(data, null, 2);
        setMessages((m) => {
          const copy = m.slice();
          copy[assistantIndex] = {
            role: "assistant",
            content: text,
            sources: data?.sources,
          };
          return copy;
        });
      } else {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let acc = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            acc += decoder.decode(value, { stream: true });
            setMessages((m) => {
              const copy = m.slice();
              copy[assistantIndex] = { role: "assistant", content: acc };
              return copy;
            });
          }
        } else {
          const text = await res.text();
          setMessages((m) => {
            const copy = m.slice();
            copy[assistantIndex] = { role: "assistant", content: text };
            return copy;
          });
        }
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry—something went wrong while contacting the chat endpoint.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
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

      <main className="mx-auto max-w-3xl w-full flex-1 px-4">
        <div
          ref={listRef}
          className="mt-6 mb-32 flex flex-col gap-5 overflow-y-auto pb-4"
          style={{ minHeight: "40vh" }}
        >
          {messages.map((m, i) => {
            if (m.role === "assistant" && !m.content) {
              return <TypingBubble key={`typing-${i}`} />;
            }
            return (
              <Message
                key={i}
                role={m.role}
                content={m.content}
                sources={m.sources}
              />
            );
          })}
        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-zinc-50/90 backdrop-blur">
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
                    if (form?.requestSubmit) form.requestSubmit();
                    else
                      form?.dispatchEvent(
                        new Event("submit", { cancelable: true, bubbles: true })
                      );
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
