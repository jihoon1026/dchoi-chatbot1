// 대화한 사용자 목록 (GitHub의 data/chats 폴더)
import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { storageKind } from "@/lib/storage";
import { listUsers } from "@/lib/store";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  try {
    return Response.json({ users: await listUsers(), storageKind });
  } catch (e) {
    return Response.json({ error: (e as Error).message, users: [], storageKind }, { status: 500 });
  }
}
