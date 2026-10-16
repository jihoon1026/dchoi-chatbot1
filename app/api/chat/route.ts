// 사용자 메시지 → (분석: 기분/경고/차단) → 챗봇 답변
import type { NextRequest } from "next/server";
import { analyzeMessage, describeApiError, generateReply } from "@/lib/ai";
import { readChatCookie } from "@/lib/auth";
import { addMessage, getMessages, getQA, getRules, getUser, newId, saveUser, type StoredMessage } from "@/lib/store";
import { BLOCKED_TEXT } from "@/lib/constants";

export const maxDuration = 60; // Vercel에서 AI 답변을 기다리는 최대 시간(초)

const HISTORY_LIMIT = 30;

export async function POST(req: NextRequest) {
  const c = readChatCookie(req);
  const user = c ? await getUser(c.userId) : null;
  if (!c || !user) return Response.json({ error: "먼저 이름과 이메일을 입력해 주세요." }, { status: 401 });
  if (user.blocked) return Response.json({ blocked: true, warning: BLOCKED_TEXT });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "챗봇 준비 중이에요. (운영자: .env 또는 Vercel 환경변수에 ANTHROPIC_API_KEY 를 넣어 주세요)" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const text = (body.message ?? "").trim();
  if (!text) return Response.json({ error: "메시지를 입력해 주세요." }, { status: 400 });
  if (text.length > 2000) return Response.json({ error: "메시지가 너무 길어요. 2000자 이내로 줄여 주세요." }, { status: 400 });

  const session = (await getMessages(user.id)).filter((m) => m.sessionId === c.sessionId);
  const history = session
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-HISTORY_LIMIT)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  // 대화는 반드시 사용자 메시지로 시작해야 합니다.
  while (history.length && history[0].role !== "user") history.shift();

  const [rules, qa] = await Promise.all([getRules(), getQA()]);
  const stamp = () => new Date().toISOString();

  try {
    const analysis = await analyzeMessage(text, history, user, rules);

    const userMsg: StoredMessage = {
      id: newId(),
      sessionId: c.sessionId,
      role: "user",
      content: text,
      createdAt: stamp(),
      mood: analysis.mood,
      flag: analysis.action,
      flagReason: [analysis.moodReason, analysis.actionReason].filter(Boolean).join(" / "),
    };
    await addMessage(user.id, userMsg);
    user.lastMood = analysis.mood;
    user.lastActiveAt = stamp();
    user.messageCount += 1;

    // 차단
    if (analysis.action === "block") {
      user.blocked = true;
      user.blockedReason = analysis.actionReason;
      await saveUser(user);
      const warning = analysis.warningMessage || BLOCKED_TEXT;
      await addMessage(user.id, { id: newId(), sessionId: c.sessionId, role: "warning", content: warning, createdAt: stamp() });
      return Response.json({ blocked: true, warning });
    }

    // 경고
    let warning: string | undefined;
    if (analysis.action === "warn") {
      user.warnings += 1;
      warning = analysis.warningMessage || "상담과 관련된 내용으로 정중하게 문의 부탁드립니다.";
      await addMessage(user.id, { id: newId(), sessionId: c.sessionId, role: "warning", content: warning, createdAt: stamp() });
    }
    await saveUser(user);

    const reply = await generateReply([...history, { role: "user", content: text }], analysis, qa, rules, user.name);
    await addMessage(user.id, { id: newId(), sessionId: c.sessionId, role: "assistant", content: reply, createdAt: stamp() });

    return Response.json({ reply, warning });
  } catch (e) {
    console.error("[chat] error", e);
    return Response.json({ error: `일시적인 오류가 발생했어요. ${describeApiError(e)}` }, { status: 500 });
  }
}
