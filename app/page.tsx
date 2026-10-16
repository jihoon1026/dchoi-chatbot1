"use client";
// 사용자 페이지: 이름/이메일 입력 → 챗봇과 대화
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { RichText } from "./RichText";

type Msg = { id: string; role: "user" | "assistant" | "warning"; content: string };
type Me = { name: string; email: string; blocked: boolean };

const SUGGESTIONS = [
  "18개월 아이에게 맞는 전집 추천해 주세요",
  "지금 할인 중인 전집이 있나요?",
  "그레이트북스 전집 종류를 알려주세요",
  "픽업과 배송은 가격이 어떻게 달라요?",
];

export default function ChatPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [blockedText, setBlockedText] = useState<string>();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setMe(d.user);
          setMessages(d.messages ?? []);
          setBlockedText(d.blockedText);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="caption" style={{ padding: 40, textAlign: "center" }}>Loading…</div>;
  if (!me)
    return (
      <Entry
        notice={notice}
        onEnter={(d) => {
          setNotice("");
          setMe(d.user);
          setMessages([]);
          setBlockedText(d.blockedText);
        }}
      />
    );
  return (
    <Chat
      me={me}
      messages={messages}
      setMessages={setMessages}
      blockedText={blockedText}
      setBlockedText={setBlockedText}
      onExpired={() => {
        setMe(null);
        setMessages([]);
        setNotice("입장 정보가 만료되었어요. 이름과 이메일을 다시 입력해 주세요.");
      }}
      onLeave={async () => {
        await fetch("/api/session", { method: "DELETE" });
        setMe(null);
        setMessages([]);
      }}
    />
  );
}

function Entry({ onEnter, notice }: { onEnter: (d: { user: Me; blockedText?: string }) => void; notice?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<{ src: string }[]>([]);

  useEffect(() => {
    fetch("/api/showcase")
      .then((r) => r.json())
      .then((d) => setImages(d.images ?? []))
      .catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!agree) return setError("대화 내용 저장에 동의해 주세요.");
    setBusy(true);
    const r = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error ?? "잠시 후 다시 시도해 주세요.");
    onEnter(d);
  }

  return (
    <main className="entry-page">
      <nav className="top-nav">
        <span className="nav-left caption">Book Concierge</span>
        <span className="wordmark">DCHOI09</span>
        <span className="nav-right caption">전집 상담</span>
      </nav>
      <section className="hero" aria-hidden>
        {images.map((img) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={img.src} src={img.src} alt="" />
        ))}
        <div className="hero-overlay">
          <h1 className="display-xl">Series Books</h1>
          <p className="caption" style={{ color: "var(--ink)" }}>
            dchoi09 전집 · AI 상담
          </p>
        </div>
      </section>
      <div className="entry-body">
        <h2 className="display-sm">상담 시작하기</h2>
        <p className="lead" style={{ marginTop: 16 }}>
          전집 추천, 가격, 구성, 배송·픽업까지. 이름과 이메일을 남기시면 바로 상담을 시작합니다.
        </p>
        <form className="entry-form" onSubmit={submit}>
          <div>
            <label className="label caption" htmlFor="name">
              Name · 이름
            </label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </div>
          <div>
            <label className="label caption" htmlFor="email">
              Email · 이메일
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>상담 품질 향상을 위해 이름, 이메일, 대화 내용이 저장되는 것에 동의합니다.</span>
          </label>
          {(error || notice) && <p className="error">{error || notice}</p>}
          <div>
            <button className="btn" disabled={busy}>
              {busy ? "Entering…" : "Start · 시작"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Chat(props: {
  me: Me;
  messages: Msg[];
  setMessages: (fn: (m: Msg[]) => Msg[]) => void;
  blockedText?: string;
  setBlockedText: (t: string) => void;
  onLeave: () => void;
  onExpired: () => void;
}) {
  const { me, messages, setMessages, blockedText, setBlockedText, onLeave, onExpired } = props;
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const blocked = Boolean(blockedText);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || sending || blocked) return;
    setInput("");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: t }]);
    setSending(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t }),
      });
      const d = await r.json();
      if (d.needEntry) return onExpired();
      const add: Msg[] = [];
      if (d.warning) add.push({ id: crypto.randomUUID(), role: "warning", content: d.warning });
      if (d.reply) add.push({ id: crypto.randomUUID(), role: "assistant", content: d.reply });
      if (d.error) add.push({ id: crypto.randomUUID(), role: "warning", content: d.error });
      setMessages((m) => [...m, ...add]);
      if (d.blocked) setBlockedText(d.warning);
    } catch {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "warning", content: "네트워크 오류가 발생했어요. 다시 시도해 주세요." }]);
    } finally {
      setSending(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <main className="chat-shell">
      <nav className="top-nav">
        <span className="nav-left caption">{me.name}님</span>
        <span className="wordmark">DCHOI09</span>
        <span className="nav-right">
          <button className="nav-link" onClick={onLeave}>
            <span className="hide-mobile">Exit · </span>나가기
          </button>
        </span>
      </nav>
      <p className="chat-sub caption">전집 상품 정보 기반 AI 상담</p>

      <div className="chat-body">
        <div className="bubble bubble-bot">
          {me.name}님, 반갑습니다. dchoi09 전집에 대해 무엇이든 물어보세요.
          {"\n"}아이 나이(개월 수)를 알려주시면 딱 맞는 전집을 추천해 드릴게요.
        </div>
        {messages.length === 0 && !blocked && (
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`bubble ${m.role === "user" ? "bubble-user" : m.role === "warning" ? "bubble-warning" : "bubble-bot"}`}
          >
            {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
          </div>
        ))}
        {sending && (
          <div className="bubble bubble-bot" aria-label="답변 작성 중">
            <span className="typing">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
        {blocked && <div className="bubble bubble-warning">{blockedText}</div>}
        <div ref={bottom} />
      </div>

      <div className="chat-input-wrap">
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          rows={1}
          placeholder={blocked ? "상담이 제한되었습니다." : "메시지를 입력하세요"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={blocked}
          maxLength={2000}
        />
        <button className="btn" disabled={sending || blocked || !input.trim()}>
          Send
        </button>
      </form>
      </div>
    </main>
  );
}
