// 사용자 한 명의 대화 기록 보기 / 차단 해제·경고 초기화
import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getChat, updateChat } from "@/lib/store";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  if (!isAdmin(req)) return unauthorized();
  const { id } = await ctx.params;
  const chat = await getChat(id);
  if (!chat) return Response.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  return Response.json(chat);
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  if (!isAdmin(req)) return unauthorized();
  const { id } = await ctx.params;
  const chat = await getChat(id);
  if (!chat) return Response.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { blocked?: boolean; warnings?: number };
  const updated = await updateChat(
    chat.user,
    (f) => {
      if (typeof body.blocked === "boolean") {
        f.user.blocked = body.blocked;
        f.user.blockedReason = body.blocked ? "관리자가 직접 차단" : undefined;
      }
      if (typeof body.warnings === "number" && body.warnings >= 0) f.user.warnings = Math.floor(body.warnings);
    },
    "관리자: 사용자 상태 변경",
  );
  return Response.json({ user: updated.user });
}
