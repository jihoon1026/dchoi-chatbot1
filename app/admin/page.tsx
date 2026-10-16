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

  if (state === "loading") return <div className="entry muted">불러오는 중…</div>;
  if (state === "login") return <Login onOk={() => setState("in")} />;

  return (
    <main className="admin">
      <div className="admin-top">
        <h1>디초이 챗봇 관리자</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn btn-sm" href="/" target="_blank">
            챗봇 열기 ↗
          </a>
          <button
            className="btn btn-sm"
            onClick={async () => {
              await fetch("/api/admin/login", { method: "DELETE" });
              setState("login");
            }}
          >
            로그아웃
          </button>
        </div>
      </div>
      <nav className="tabs">
        {(
          [
            ["logs", "대화 기록"],
            ["qa", "질의응답"],
            ["rules", "챗봇 규칙"],
            ["products", "전집 상품(엑셀)"],
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
    <main className="entry">
      <form className="entry-card" onSubmit={submit}>
        <h1>관리자 로그인</h1>
        <div>
          <label className="label" htmlFor="pw">
            비밀번호
          </label>
          <input id="pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary">로그인</button>
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
      {storage === "temp-file" && (
        <div className="banner">
          ⚠️ 저장소(Upstash Redis)가 연결되지 않아 대화 기록이 곧 사라질 수 있어요. 안내서의 &quot;Redis 연결&quot; 단계를 진행해 주세요.
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="split">
        <div className="card user-list">
          <div style={{ padding: 12, borderBottom: "1px solid var(--line)", display: "flex", gap: 8 }}>
            <input className="input" placeholder="이름·이메일 검색" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-sm" onClick={loadUsers} title="새로고침">
              ↻
            </button>
          </div>
          {filtered.length === 0 && <p className="muted" style={{ padding: 14 }}>아직 대화한 사용자가 없어요.</p>}
          {filtered.map((u) => (
            <button key={u.id} className={`user-item ${sel === u.id ? "user-item-active" : ""}`} onClick={() => loadDetail(u.id)}>
              <div className="user-item-name">{u.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {u.email}
              </div>
              <div className="user-meta">
                <span className="badge">{u.messageCount}개 질문</span>
                {u.lastMood && <span className={`badge ${moodClass(u.lastMood)}`}>{u.lastMood}</span>}
                {u.warnings > 0 && <span className="badge badge-warn">경고 {u.warnings}</span>}
                {u.blocked && <span className="badge badge-danger">차단됨</span>}
                <span className="muted">{fmt(u.lastActiveAt)}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="card">
          {!detail ? (
            <p className="muted">왼쪽에서 사용자를 선택하면 대화 기록이 보여요.</p>
          ) : (
            <>
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <div>
                  <strong>{detail.user.name}</strong> <span className="muted">{detail.user.email}</span>
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
                      {newSession && <div className="session-sep">── 대화 시작 {fmt(m.createdAt)} ──</div>}
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
    if (!confirm("엑셀의 '질의응답' 시트 내용으로 지금 목록을 전부 바꿀까요?")) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const d = await api<{ count: number }>("/api/admin/excel", { method: "POST", body: fd });
      setMsg(`엑셀에서 ${d.count}개를 불러왔어요.`);
      load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  const filtered = list.filter((x) => `${x.question} ${x.answer} ${x.category} ${x.product}`.toLowerCase().includes(q.toLowerCase()));
  const set = (k: keyof typeof emptyQA) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <p className="muted" style={{ marginBottom: 12 }}>
        챗봇은 여기 있는 답변을 상품 정보보다 먼저 따릅니다. 저장 즉시 챗봇에 반영돼요.
      </p>
      <div className="toolbar">
        <input className="input" placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="btn btn-primary"
          onClick={() => {
            setForm(emptyQA);
            setOpen(true);
          }}
        >
          + 새 질의응답
        </button>
        <a className="btn" href="/api/admin/excel">
          엑셀 내려받기
        </a>
        <label className="btn">
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
        <form className="card form-grid" style={{ marginBottom: 16 }} onSubmit={save}>
          <div className="full">
            <label className="label">질문</label>
            <input className="input" value={form.question} onChange={set("question")} required />
          </div>
          <div className="full">
            <label className="label">답변</label>
            <textarea className="textarea" value={form.answer} onChange={set("answer")} required rows={5} />
          </div>
          <div>
            <label className="label">분류 (예: 배송, 결제)</label>
            <input className="input" value={form.category} onChange={set("category")} />
          </div>
          <div>
            <label className="label">관련 상품명 (선택)</label>
            <input className="input" value={form.product} onChange={set("product")} />
          </div>
          <div className="full" style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary">{form.id ? "수정 저장" : "추가"}</button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              취소
            </button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
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
                  <strong>{x.question}</strong>
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
                    className="btn btn-sm"
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
    <div className="card">
      {RULE_INFO.map(([k, title, desc]) => (
        <div className="rule-block" key={k}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <h3>{title}</h3>
              <span className="muted" style={{ fontSize: 13 }}>
                {desc}
              </span>
            </div>
            <button className="btn btn-sm" onClick={() => setRules({ ...rules, [k]: defaults[k] })}>
              기본값으로
            </button>
          </div>
          <textarea className="textarea" value={rules[k]} onChange={(e) => setRules({ ...rules, [k]: e.target.value })} />
        </div>
      ))}
      <div className="toolbar">
        <button className="btn btn-primary" onClick={save}>
          규칙 저장
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
      <p className="muted" style={{ marginBottom: 12 }}>
        챗봇이 학습한 엑셀(data/jeonjip.xlsx)의 상품 목록이에요. 상품 정보를 새로 받으려면 내 컴퓨터에서 <code>npm run crawl</code> 후 GitHub에
        올리면 됩니다.
      </p>
      <div className="toolbar">
        <input className="input" placeholder="상품명·브랜드·태그 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 160 }} value={age} onChange={(e) => setAge(e.target.value)}>
          <option value="">전체 연령</option>
          {ages.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <a className="btn" href="/api/admin/excel">
          엑셀 내려받기
        </a>
        <span className="muted">
          {filtered.length} / {products.length}개
        </span>
      </div>
      <div className="card table-wrap">
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
                  {p.shipCompare && p.shipCompare > (p.shipPrice ?? 0) ? <div className="muted"><s>{usd(p.shipCompare)}</s></div> : null}
                </td>
                <td>{usd(p.pickupPrice)}</td>
                <td>{p.available ? <span className="badge badge-ok">판매중</span> : <span className="badge badge-danger">품절</span>}</td>
                <td>
                  {p.detail ? (
                    <>
                      <button className="btn btn-sm" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
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
