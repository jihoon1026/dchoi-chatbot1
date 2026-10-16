// 엑셀 내려받기(상품 + 현재 질의응답) / 엑셀 올려서 질의응답 한꺼번에 바꾸기
import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { readWorkbook, writeWorkbook } from "@/lib/excel";
import { products } from "@/lib/knowledge";
import { getQA, saveQA } from "@/lib/store";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const buf = await writeWorkbook(products, await getQA());
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="jeonjip-${date}.xlsx"`,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "엑셀 파일을 선택해 주세요." }, { status: 400 });
  try {
    const { qa } = await readWorkbook(await file.arrayBuffer());
    if (!qa.length) return Response.json({ error: "'질의응답' 시트에서 항목을 찾지 못했어요." }, { status: 400 });
    await saveQA(qa.map((q) => ({ ...q, updatedAt: q.updatedAt || new Date().toISOString() })));
    return Response.json({ count: qa.length });
  } catch {
    return Response.json({ error: "엑셀 파일을 읽을 수 없어요. 내려받은 양식을 사용해 주세요." }, { status: 400 });
  }
}
