// 관리자 로그인 / 로그아웃 / 로그인 상태 확인
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, adminCookieValue, checkAdminPassword, cookieOptions, isAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return Response.json({ admin: isAdmin(req), passwordSet: Boolean(process.env.ADMIN_PASSWORD) });
}

export async function POST(req: NextRequest) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!process.env.ADMIN_PASSWORD) {
    return Response.json({ error: ".env 파일에 ADMIN_PASSWORD 가 설정되지 않았습니다." }, { status: 500 });
  }
  if (!password || !checkAdminPassword(password)) {
    return Response.json({ error: "비밀번호가 틀렸습니다." }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${adminCookieValue()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 12}${cookieOptions.secure ? "; Secure" : ""}`,
  );
  return res;
}

export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
