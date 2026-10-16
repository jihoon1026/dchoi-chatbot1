// 엑셀 내려받기 (GitHub에 있는 그대로) / 엑셀 올려서 GitHub의 엑셀 파일 교체
import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { writeWorkbook } from "@/lib/excel";
import { EXCEL_PATH, getKnowledge, replaceExcel } from "@/lib/knowledge";
import { readFile } from "@/lib/storage";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const file = await readFile(EXCEL_PATH);
  const k = file ? null : await getKnowledge();
  const buf = file ? file.data : await writeWorkbook(k!.products, k!.qa);
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
    const result = await replaceExcel(Buffer.from(await file.arrayBuffer()));
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: `엑셀 파일을 반영하지 못했어요: ${(e as Error).message}` }, { status: 400 });
  }
}
