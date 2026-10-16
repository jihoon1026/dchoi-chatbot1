// 쿠키 서명(위조 방지) + 관리자 로그인 확인
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

const SECRET = process.env.SESSION_SECRET || "dev-only-secret-please-set-SESSION_SECRET";

export const CHAT_COOKIE = "dchoi_chat";
export const ADMIN_COOKIE = "dchoi_admin";

function sign(value: string): string {
  const mac = crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
  return `${value}.${mac}`;
}

function verify(signed: string | undefined): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const expected = sign(value);
  const a = Buffer.from(signed);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? value : null;
}

// ---------- 채팅 사용자 ----------
// 쿠키에 이름/이메일도 함께 담아 둡니다. 저장소에서 사용자 기록이 사라져도 다시 만들 수 있게요.
export interface ChatCookie {
  userId: string;
  sessionId: string;
  name: string;
  email: string;
}

export function chatCookieValue(c: ChatCookie) {
  return sign(Buffer.from(JSON.stringify(c)).toString("base64url"));
}

export function readChatCookie(req: NextRequest): ChatCookie | null {
  const v = verify(req.cookies.get(CHAT_COOKIE)?.value);
  if (!v) return null;
  try {
    const c = JSON.parse(Buffer.from(v, "base64url").toString("utf-8")) as Partial<ChatCookie>;
    if (!c.userId || !c.sessionId || !c.email) return null;
    return { userId: c.userId, sessionId: c.sessionId, name: c.name ?? "", email: c.email };
  } catch {
    return null; // 예전 형식 쿠키 → 다시 입장
  }
}

// ---------- 관리자 ----------
export function checkAdminPassword(pw: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  const a = crypto.createHash("sha256").update(pw).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export function adminCookieValue() {
  return sign(`admin:${Date.now()}`);
}

const ADMIN_MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12시간

export function isAdmin(req: NextRequest): boolean {
  const v = verify(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!v?.startsWith("admin:")) return false;
  return Date.now() - Number(v.slice(6)) < ADMIN_MAX_AGE_MS;
}

export const unauthorized = () => Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
