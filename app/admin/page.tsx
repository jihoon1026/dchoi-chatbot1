"use client";
// 운영자 페이지: 대화 기록 / 질의응답 관리 / 챗봇 규칙 / 상품(엑셀)
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { ChatMessage, ChatUser, Product, QAItem, Rules } from "@/lib/types";
import { RichText } from "../RichText";

type Tab = "logs" | "qa" | "rules" | "products";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `오류 (${r.status})`);
  return d as T;
}
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "-");

export default function AdminPage() {
  const [state, setState] = useState<"loading" | "login" | "in">("loading");
  const [tab, setTab] = useState<Tab>("logs");

  useEffect(() => {
    api<{ admin: boolean }>("/api/admin/login")
      .then((d) => setState(d.admin ? "in" : "login"))
      .catch(() => setState("login"));
  }, []);

  if (state === "loading") return <div className="caption" style={{ padding: 40, textAlign: "center" }}>Loading…</div>;
  if (state === "login") return <Login onOk={() => setState("in")} />;

  return (
    <>
    <nav className="top-nav">
      <a className="nav-left nav-link" href="/" target="_blank">
        Chatbot ↗
      </a>
      <span className="wordmark">DCHOI09</span>
      <span className="nav-right">
        <button
          className="nav-link"
          onClick={async () => {
            await fetch("/api/admin/login", { method: "DELETE" });
            setState("login");
          }}
        >
          Logout
        </button>
      </span>
    </nav>
    <main className="admin">
      <div className="admin-head">
        <span className="caption">Admin Console</span>
        <h1 className="display-lg">관리자</h1>
      </div>
      <nav className="tabs">
        {(
          [
            ["logs", "대화 기록 · Logs"],
            ["qa", "질의응답 · Q&A"],
            ["rules", "규칙 · Rules"],
            ["products", "상품 · Excel"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} className={`tab ${tab === k ? "tab-active" : ""}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === "logs" && <Logs />}
      {tab === "qa" && <QAPanel />}
      {tab === "rules" && <RulesPanel />}
      {tab === "products" && <ProductsPanel />}
    </main>
    </>
  );
}

function Login({ onOk }: { onOk: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/admin/login", json("POST", { password: pw }));
      onOk();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <main className="entry-page">
      <nav className="top-nav">
        <span className="nav-left caption">Admin</span>
        <span className="wordmark">DCHOI09</span>
        <span />
      </nav>
      <form className="entry-body entry-form" onSubmit={submit}>
        <h1 className="display-md">관리자 로그인</h1>
        <div>
          <label className="label caption" htmlFor="pw">
            Password · 비밀번호
          </label>
          <input id="pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </div>
        {error && <p className="error">{error}</p>}
        <div>
          <button className="btn">Login · 로그인</button>
        </div>
      </form>
    </main>
  );
}

// ---------------- 대화 기록 ----------------
const moodClass = (m?: string) =>
  m === "화남" || m === "불만" ? "badge-danger" : m === "불안" || m === "혼란" ? "badge-warn" : m === "긍정" ? "badge-ok" : "";

function Logs() {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [storage, setStorage] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ user: ChatUser; messages: (ChatMessage & { sessionId: string })[] } | null>(null);
  const [error, setError] = useState("");

  const loadUsers = useCallback(() => {
    api<{ users: ChatUser[]; storageKind: string }>("/api/admin/users")
      .then((d) => {
        setUsers(d.users);
        setStorage(d.storageKind);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(loadUsers, [loadUsers]);

  const loadDetail = useCallback((id: string) => {
    setSel(id);
    api<typeof detail>(`/api/admin/users/${id}`).then(setDetail).catch((e) => setError(e.message));
  }, []);

  async function patch(body: { blocked?: boolean; warnings?: number }) {
    if (!detail) return;
    await api(`/api/admin/users/${detail.user.id}`, json("PATCH", body));
    loadDetail(detail.user.id);
    loadUsers();
  }

  const filtered = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      {storage === "temp" && (
        <div className="banner">
          GitHub 저장이 연결되지 않아 대화 기록이 곧 사라질 수 있어요. Vercel 환경변수에 GITHUB_TOKEN 과 GITHUB_REPO 를 넣어 주세요.
        </div>
      )}
      {storage === "local" && <div className="notice">내 컴퓨터 테스트 모드: 대화 기록은 .data 폴더에 저장돼요 (GitHub에는 올라가지 않음).</div>}
      {storage === "github" && <div className="notice">대화 기록은 GitHub 레포의 data/chats 폴더에 저장돼요.</div>}
      {error && <p className="error">{error}</p>}
      <div className="split">
        <div>
        <div className="user-search">
          <input className="input" placeholder="이름·이메일 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-icon btn-quiet" onClick={loadUsers} title="새로고침">
            ↻
          </button>
        </div>
        <div className="user-list">
          {filtered.length === 0 && <p className="muted" style={{ padding: "16px 8px" }}>아직 대화한 사용자가 없어요.</p>}
          {filtered.map((u) => (
            <button key={u.id} className={`user-item ${sel === u.id ? "user-item-active" : ""}`} onClick={() => loadDetail(u.id)}>
              <div className="user-item-name">{u.name}</div>
              <div className="muted body-sm">{u.email}</div>
              <div className="user-meta">
                <span className="badge">{u.messageCount} 질문</span>
                {u.lastMood && <span className={`badge ${moodClass(u.lastMood)}`}>{u.lastMood}</span>}
                {u.warnings > 0 && <span className="badge badge-warn">경고 {u.warnings}</span>}
                {u.blocked && <span className="badge badge-danger">차단됨</span>}
                <span className="badge">{fmt(u.lastActiveAt)}</span>
              </div>
            </button>
          ))}
        </div>
        </div>

        <div className="card">
          {!detail ? (
            <p className="muted">왼쪽에서 사용자를 선택하면 대화 기록이 보여요.</p>
          ) : (
            <>
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="display-sm">{detail.user.name}</div>
                  <span className="muted body-sm">{detail.user.email}</span>
                  <div className="user-meta">
                    <span className="badge">가입 {fmt(detail.user.createdAt)}</span>
                    <span className="badge badge-warn">경고 {detail.user.warnings}회</span>
                    {detail.user.blocked && <span className="badge badge-danger">차단됨: {detail.user.blockedReason}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {detail.user.warnings > 0 && (
                    <button className="btn btn-sm" onClick={() => patch({ warnings: 0 })}>
                      경고 초기화
                    </button>
                  )}
                  {detail.user.blocked ? (
                    <button className="btn btn-sm btn-primary" onClick={() => patch({ blocked: false })}>
                      차단 해제
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-danger" onClick={() => confirm("이 사용자를 차단할까요?") && patch({ blocked: true })}>
                      차단하기
                    </button>
                  )}
                </div>
              </div>
              <div className="log">
                {detail.messages.length === 0 && <p className="muted">아직 주고받은 메시지가 없어요.</p>}
                {detail.messages.map((m, i) => {
                  const newSession = i === 0 || detail.messages[i - 1].sessionId !== m.sessionId;
                  return (
                    <div key={m.id} style={{ display: "contents" }}>
                      {newSession && <div className="session-sep caption">Session · {fmt(m.createdAt)}</div>}
                      <div
                        className={`bubble ${m.role === "user" ? "bubble-user" : m.role === "warning" ? "bubble-warning" : "bubble-bot"}`}
                      >
                        {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
                      </div>
                      {m.role === "user" && (
                        <div className="log-meta" style={{ alignSelf: "flex-end" }}>
                          {m.mood && <span className={`badge ${moodClass(m.mood)}`}>기분: {m.mood}</span>}
                          {m.flag && m.flag !== "none" && (
                            <span className={`badge ${m.flag === "block" ? "badge-danger" : "badge-warn"}`}>
                              {m.flag === "block" ? "차단" : "경고"}
                            </span>
                          )}
                          {m.flagReason && <span>{m.flagReason}</span>}
                          <span>{fmt(m.createdAt)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------- 질의응답 ----------------
const emptyQA = { id: "", question: "", answer: "", category: "", product: "" };

function QAPanel() {
  const [list, setList] = useState<QAItem[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(emptyQA);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api<{ qa: QAItem[] }>("/api/admin/qa").then((d) => setList(d.qa)).catch((e) => setMsg(e.message));
  }, []);
  useEffect(load, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/admin/qa", json("POST", form));
      setMsg(form.id ? "수정했어요." : "추가했어요.");
      setForm(emptyQA);
      setOpen(false);
      load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function remove(item: QAItem) {
    if (!confirm(`삭제할까요?\n\nQ. ${item.question}`)) return;
    await api(`/api/admin/qa/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    load();
  }

  async function upload(file: File) {
    if (!confirm("올린 엑셀 파일로 GitHub의 엑셀(상품 + 질의응답)을 통째로 바꿀까요?")) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const d = await api<{ products: number; qa: number }>("/api/admin/excel", { method: "POST", body: fd });
      setMsg(`엑셀 교체 완료: 상품 ${d.products}개, 질의응답 ${d.qa}개`);
      load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  const filtered = list.filter((x) => `${x.question} ${x.answer} ${x.category} ${x.product}`.toLowerCase().includes(q.toLowerCase()));
  const set = (k: keyof typeof emptyQA) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="notice">
        질의응답은 GitHub의 엑셀(data/jeonjip.xlsx) 질의응답 시트에 저장되고, 저장 즉시 챗봇에 반영돼요. 챗봇은 이 답변을 상품 정보보다
        먼저 따릅니다.
      </div>
      <div className="toolbar">
        <input className="input" placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="btn btn-sm"
          onClick={() => {
            setForm(emptyQA);
            setOpen(true);
          }}
        >
          + 새 질의응답
        </button>
        <a className="btn btn-sm btn-quiet" href="/api/admin/excel">
          엑셀 내려받기
        </a>
        <label className="btn btn-sm btn-quiet">
          엑셀 올리기
          <input
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
        <span className="muted">총 {list.length}개</span>
        {msg && <span className="badge badge-accent">{msg}</span>}
      </div>

      {open && (
        <form className="card form-grid" onSubmit={save}>
          <div className="full">
            <label className="label caption">Question · 질문</label>
            <input className="input" value={form.question} onChange={set("question")} required />
          </div>
          <div className="full">
            <label className="label caption">Answer · 답변</label>
            <textarea className="textarea" value={form.answer} onChange={set("answer")} required rows={5} />
          </div>
          <div>
            <label className="label caption">Category · 분류</label>
            <input className="input" value={form.category} onChange={set("category")} />
          </div>
          <div>
            <label className="label caption">Product · 관련 상품 (선택)</label>
            <input className="input" value={form.product} onChange={set("product")} />
          </div>
          <div className="full" style={{ display: "flex", gap: 8 }}>
            <button className="btn">{form.id ? "수정 저장" : "추가"}</button>
            <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>
              취소
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>분류</th>
              <th>질문</th>
              <th>답변</th>
              <th>관련상품</th>
              <th>수정일</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((x) => (
              <tr key={x.id}>
                <td>{x.category && <span className="badge">{x.category}</span>}</td>
                <td style={{ minWidth: 180 }}>
                  <span className="q">{x.question}</span>
                </td>
                <td className="pre" style={{ minWidth: 280 }}>
                  {x.answer}
                </td>
                <td>{x.product}</td>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>
                  {fmt(x.updatedAt)}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button
                    className="btn btn-sm btn-quiet"
                    onClick={() => {
                      setForm({ id: x.id, question: x.question, answer: x.answer, category: x.category, product: x.product });
                      setOpen(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    수정
                  </button>{" "}
                  <button className="btn btn-sm btn-danger" onClick={() => remove(x)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------- 규칙 ----------------
type RuleKey = "response" | "mood" | "abuse" | "block";
const RULE_INFO: [RuleKey, string, string][] = [
  ["response", "응대 규칙", "챗봇의 말투, 답변 방식, 지켜야 할 원칙"],
  ["mood", "사용자 기분 파악 규칙", "메시지마다 사용자 기분을 판단하는 기준과 기분별 응대법"],
  ["abuse", "이상 사용자 판별 및 경고 규칙", "어떤 행동을 경고할지, 경고 문구는 어떻게 할지"],
  ["block", "차단 규칙", "언제 대화를 막을지 (차단된 사용자는 대화 기록 탭에서 해제 가능)"],
];

function RulesPanel() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [defaults, setDefaults] = useState<Omit<Rules, "updatedAt"> | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<{ rules: Rules; defaults: Omit<Rules, "updatedAt"> }>("/api/admin/rules").then((d) => {
      setRules(d.rules);
      setDefaults(d.defaults);
    });
  }, []);

  if (!rules || !defaults) return <p className="muted">불러오는 중…</p>;

  async function save() {
    const d = await api<{ rules: Rules }>("/api/admin/rules", json("PUT", rules));
    setRules(d.rules);
    setMsg(`저장했어요 (${fmt(d.rules.updatedAt)}). 다음 대화부터 바로 적용돼요.`);
  }

  return (
    <div>
      <div className="notice">규칙은 GitHub 레포의 data/rules.json 에 저장되고, 저장하면 다음 대화부터 바로 적용돼요.</div>
      {RULE_INFO.map(([k, title, desc]) => (
        <div className="rule-block" key={k}>
          <div className="rule-head">
            <div>
              <h3 className="title-md">{title}</h3>
              <span className="muted body-sm">{desc}</span>
            </div>
            <button className="btn btn-sm btn-quiet" onClick={() => setRules({ ...rules, [k]: defaults[k] })}>
              기본값으로
            </button>
          </div>
          <textarea className="textarea" value={rules[k]} onChange={(e) => setRules({ ...rules, [k]: e.target.value })} />
        </div>
      ))}
      <div className="toolbar" style={{ marginTop: 40 }}>
        <button className="btn" onClick={save}>
          Save · 규칙 저장
        </button>
        {msg && <span className="badge badge-ok">{msg}</span>}
        {!msg && rules.updatedAt && <span className="muted">마지막 저장: {fmt(rules.updatedAt)}</span>}
      </div>
    </div>
  );
}

// ---------------- 상품 ----------------
function ProductsPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [age, setAge] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    api<{ products: Product[] }>("/api/admin/products").then((d) => setProducts(d.products));
  }, []);

  const ages = useMemo(() => [...new Set(products.flatMap((p) => p.ages))], [products]);
  const filtered = products.filter(
    (p) => (!age || p.ages.includes(age)) && `${p.title} ${p.brand} ${p.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()),
  );
  const usd = (n: number | null) => (n == null ? "-" : `$${n.toFixed(2)}`);

  return (
    <>
      <div className="notice">
        챗봇이 읽는 GitHub의 엑셀(data/jeonjip.xlsx) 상품 목록이에요. 상품 정보를 새로 받으려면 내 컴퓨터에서 <code>npm run crawl</code> 을
        실행하면 GitHub의 엑셀까지 자동으로 바뀝니다.
      </div>
      <div className="toolbar">
        <input className="input" placeholder="상품명·브랜드·태그 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 160 }} value={age} onChange={(e) => setAge(e.target.value)}>
          <option value="">전체 연령</option>
          {ages.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <a className="btn btn-sm btn-quiet" href="/api/admin/excel">
          엑셀 내려받기
        </a>
        <span className="badge">
          {filtered.length} / {products.length}
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>상품명</th>
              <th>브랜드</th>
              <th>연령</th>
              <th>배송가</th>
              <th>픽업가</th>
              <th>상태</th>
              <th>상세정보</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td style={{ minWidth: 220 }}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.title}
                  </a>
                </td>
                <td>{p.brand}</td>
                <td>{p.ages.join(", ")}</td>
                <td>
                  {usd(p.shipPrice)}
                  {p.shipCompare && p.shipCompare > (p.shipPrice ?? 0) ? <div className="price-old">{usd(p.shipCompare)}</div> : null}
                </td>
                <td>{usd(p.pickupPrice)}</td>
                <td>{p.available ? <span className="badge badge-ok">판매중</span> : <span className="badge badge-danger">품절</span>}</td>
                <td>
                  {p.detail ? (
                    <>
                      <button className="btn btn-sm btn-quiet" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                        {openId === p.id ? "접기" : "보기"}
                      </button>
                      {openId === p.id && <div className="detail-text" style={{ marginTop: 8 }}>{p.detail}</div>}
                    </>
                  ) : (
                    <span className="muted">없음</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
