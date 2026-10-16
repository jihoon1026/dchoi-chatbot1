// 사용자 메시지 → (분석: 기분/경고/차단) → 챗봇 답변 → GitHub의 대화 파일에 한 번에 저장
import type { NextRequest } from "next/server";
import { analyzeMessage, describeApiError, generateReply } from "@/lib/ai";
import { readChatCookie } from "@/lib/auth";
import { BLOCKED_TEXT } from "@/lib/constants";
import { getKnowledge } from "@/lib/knowledge";
import { getChat, getRules, getUserForCookie, newId, updateChat, userIdFromEmail, type StoredMessage } from "@/lib/store";

export const maxDuration = 60; // Vercel에서 AI 답변을 기다리는 최대 시간(초)

const HISTORY_LIMIT = 30;

export async function POST(req: NextRequest) {
  const c = readChatCookie(req);
  if (!c) return Response.json({ error: "먼저 이름과 이메일을 입력해 주세요.", needEntry: true }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "챗봇 준비 중이에요. (운영자: .env 또는 Vercel 환경변수에 ANTHROPIC_API_KEY 를 넣어 주세요)" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const text = (body.message ?? "").trim();
  if (!text) return Response.json({ error: "메시지를 입력해 주세요." }, { status: 400 });
  if (text.length > 2000) return Response.json({ error: "메시지가 너무 길어요. 2000자 이내로 줄여 주세요." }, { status: 400 });

  try {
    const [chat, rules, knowledge] = await Promise.all([getChat(userIdFromEmail(c.email)), getRules(), getKnowledge()]);
    const user = chat?.user ?? (await getUserForCookie(c));
    if (user.blocked) return Response.json({ blocked: true, warning: BLOCKED_TEXT });

    const history = (chat?.messages ?? [])
      .filter((m) => m.sessionId === c.sessionId && (m.role === "user" || m.role === "assistant"))
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    // 대화는 반드시 사용자 메시지로 시작해야 합니다.
    while (history.length && history[0].role !== "user") history.shift();

    const stamp = () => new Date().toISOString();
    const msg = (role: StoredMessage["role"], content: string, extra: Partial<StoredMessage> = {}): StoredMessage => ({
      id: newId(),
      sessionId: c.sessionId,
      role,
      content,
      createdAt: stamp(),
      ...extra,
    });

    const analysis = await analyzeMessage(text, history, user, rules);
    const newMessages: StoredMessage[] = [
      msg("user", text, {
        mood: analysis.mood,
        flag: analysis.action,
        flagReason: [analysis.moodReason, analysis.actionReason].filter(Boolean).join(" / "),
      }),
    ];

    let warning: string | undefined;
    let reply: string | undefined;
    if (analysis.action === "block") {
      warning = analysis.warningMessage || BLOCKED_TEXT;
      newMessages.push(msg("warning", warning));
    } else {
      if (analysis.action === "warn") {
        warning = analysis.warningMessage || "상담과 관련된 내용으로 정중하게 문의 부탁드립니다.";
        newMessages.push(msg("warning", warning));
      }
      reply = await generateReply([...history, { role: "user", content: text }], analysis, knowledge, rules, c.name || user.name);
      newMessages.push(msg("assistant", reply));
    }

    // 대화 파일에 한 번에 저장 (다른 요청과 겹치면 다시 읽어서 덧붙임)
    await updateChat(user, (f) => {
      f.user.name = c.name || f.user.name;
      f.user.lastActiveAt = stamp();
      f.user.lastMood = analysis.mood;
      f.user.messageCount += 1;
      if (analysis.action === "warn") f.user.warnings += 1;
      if (analysis.action === "block") {
        f.user.blocked = true;
        f.user.blockedReason = analysis.actionReason;
      }
      f.messages.push(...newMessages);
    });

    return analysis.action === "block" ? Response.json({ blocked: true, warning }) : Response.json({ reply, warning });
  } catch (e) {
    console.error("[chat] error", e);
    return Response.json({ error: `일시적인 오류가 발생했어요. ${describeApiError(e)}` }, { status: 500 });
  }
}
