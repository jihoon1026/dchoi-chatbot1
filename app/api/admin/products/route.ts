// 엑셀에서 읽어온 전집 상품 목록 (읽기 전용)
import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { products } from "@/lib/knowledge";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  return Response.json({ products });
}
