// 질의응답 삭제
import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { deleteQA } from "@/lib/store";

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/admin/qa/[id]">) {
  if (!isAdmin(req)) return unauthorized();
  const { id } = await ctx.params;
  await deleteQA(id);
  return Response.json({ ok: true });
}
