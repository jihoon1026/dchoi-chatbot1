// 대화한 사용자 목록
import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { storageKind } from "@/lib/db";
import { listUsers } from "@/lib/store";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  return Response.json({ users: await listUsers(), storageKind });
}
