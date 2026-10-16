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
export function chatCookieValue(userId: string, sessionId: string) {
  return sign(`${userId}:${sessionId}`);
}

export function readChatCookie(req: NextRequest): { userId: string; sessionId: string } | null {
  const v = verify(req.cookies.get(CHAT_COOKIE)?.value);
  if (!v) return null;
  const [userId, sessionId] = v.split(":");
  return userId && sessionId ? { userId, sessionId } : null;
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
