// 챗봇 규칙 보기 / 수정
import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { DEFAULT_RULES } from "@/lib/defaultRules";
import { getRules, saveRules } from "@/lib/store";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  return Response.json({ rules: await getRules(), defaults: DEFAULT_RULES });
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const field = (k: string) => (typeof b[k] === "string" ? (b[k] as string).slice(0, 20000) : "");
  const rules = await saveRules({
    response: field("response"),
    mood: field("mood"),
    abuse: field("abuse"),
    block: field("block"),
  });
  return Response.json({ rules });
}
