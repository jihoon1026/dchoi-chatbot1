// 사용자 입장(이름+이메일) / 현재 대화 불러오기 / 나가기
import type { NextRequest } from "next/server";
import { CHAT_COOKIE, chatCookieValue, cookieOptions, readChatCookie } from "@/lib/auth";
import { BLOCKED_TEXT } from "@/lib/constants";
import { getChat, getUserForCookie, newId, userIdFromEmail } from "@/lib/store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function GET(req: NextRequest) {
  const c = readChatCookie(req);
  if (!c) return Response.json({ user: null });
  const chat = await getChat(userIdFromEmail(c.email));
  const user = chat?.user ?? (await getUserForCookie(c));
  const messages = (chat?.messages ?? [])
    .filter((m) => m.sessionId === c.sessionId)
    .map(({ id, role, content, createdAt }) => ({ id, role, content, createdAt }));
  return Response.json({
    user: { name: c.name || user.name, email: user.email, blocked: user.blocked },
    messages,
    blockedText: user.blocked ? BLOCKED_TEXT : undefined,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string };
  const name = (body.name ?? "").trim().slice(0, 40);
  const email = (body.email ?? "").trim().toLowerCase().slice(0, 120);
  if (!name) return Response.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return Response.json({ error: "올바른 이메일 주소를 입력해 주세요." }, { status: 400 });

  // 입장만으로는 저장하지 않아요. 첫 메시지를 보낼 때 대화 파일이 만들어집니다.
  const user = await getUserForCookie({ name, email });
  const res = Response.json({
    user: { name, email: user.email, blocked: user.blocked },
    messages: [],
    blockedText: user.blocked ? BLOCKED_TEXT : undefined,
  });
  // 새 입장마다 새 대화(세션)로 시작합니다. 이전 대화는 관리자 페이지에서 볼 수 있어요.
  const value = chatCookieValue({ userId: user.id, sessionId: newId(), name, email: user.email });
  res.headers.append(
    "Set-Cookie",
    `${CHAT_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${cookieOptions.secure ? "; Secure" : ""}`,
  );
  return res;
}

export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${CHAT_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
