// 질의응답 목록 보기 / 추가·수정
import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getQA, upsertQA } from "@/lib/store";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  return Response.json({ qa: await getQA() });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    id?: string; question?: string; answer?: string; category?: string; product?: string;
  };
  if (!body.question?.trim() || !body.answer?.trim()) {
    return Response.json({ error: "질문과 답변을 모두 입력해 주세요." }, { status: 400 });
  }
  const item = await upsertQA({ ...body, question: body.question, answer: body.answer });
  return Response.json({ item });
}
