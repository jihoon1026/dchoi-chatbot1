// 사용자, 대화, 질의응답, 규칙을 저장하고 꺼내는 함수 모음
import crypto from "node:crypto";
import { kv } from "./db";
import { DEFAULT_RULES } from "./defaultRules";
import { excelQA } from "./knowledge";
import type { ChatMessage, ChatUser, QAItem, Rules } from "./types";

const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

// ---------- 사용자 ----------
export async function getUser(id: string): Promise<ChatUser | null> {
  const raw = await kv.hget("users", id);
  return raw ? (JSON.parse(raw) as ChatUser) : null;
}

export async function saveUser(u: ChatUser) {
  await kv.hset("users", u.id, JSON.stringify(u));
}

export async function listUsers(): Promise<ChatUser[]> {
  const all = await kv.hgetall("users");
  return Object.values(all)
    .map((v) => JSON.parse(v) as ChatUser)
    .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
}

/** 같은 이메일이면 같은 사용자로 묶습니다 (경고/차단 기록 유지). */
export async function findOrCreateUser(name: string, email: string): Promise<ChatUser> {
  const key = email.trim().toLowerCase();
  const existingId = await kv.hget("emails", key);
  if (existingId) {
    const u = await getUser(existingId);
    if (u) {
      u.name = name;
      u.lastActiveAt = now();
      await saveUser(u);
      return u;
    }
  }
  const u: ChatUser = {
    id: newId(),
    name,
    email: key,
    createdAt: now(),
    lastActiveAt: now(),
    warnings: 0,
    blocked: false,
    messageCount: 0,
  };
  await saveUser(u);
  await kv.hset("emails", key, u.id);
  return u;
}

/** 쿠키의 사용자를 찾고, 저장소에서 사라졌으면 쿠키 정보(이름/이메일)로 다시 만듭니다. */
export async function getOrRestoreUser(c: { userId: string; name: string; email: string }): Promise<ChatUser> {
  const found = await getUser(c.userId);
  if (found) return found;
  // 같은 이메일로 저장된 기록이 있으면 그 사람으로 이어갑니다 (경고/차단 유지).
  const byEmail = await kv.hget("emails", c.email);
  if (byEmail) {
    const u = await getUser(byEmail);
    if (u) return u;
  }
  const u: ChatUser = {
    id: c.userId,
    name: c.name || c.email.split("@")[0],
    email: c.email,
    createdAt: now(),
    lastActiveAt: now(),
    warnings: 0,
    blocked: false,
    messageCount: 0,
  };
  await saveUser(u);
  await kv.hset("emails", c.email, u.id);
  return u;
}

// ---------- 대화 ----------
export interface StoredMessage extends ChatMessage {
  sessionId: string;
}

export async function addMessage(userId: string, m: StoredMessage) {
  await kv.rpush(`msgs:${userId}`, JSON.stringify(m));
}

export async function getMessages(userId: string): Promise<StoredMessage[]> {
  return (await kv.lrange(`msgs:${userId}`)).map((s) => JSON.parse(s) as StoredMessage);
}

// ---------- 질의응답 ----------
// 처음에는 엑셀의 질의응답 시트로 시작하고, 관리자가 고치면 저장소에 따로 보관합니다.
export async function getQA(): Promise<QAItem[]> {
  const raw = await kv.get("qa");
  return raw ? (JSON.parse(raw) as QAItem[]) : excelQA;
}

export async function saveQA(list: QAItem[]) {
  await kv.set("qa", JSON.stringify(list));
}

export async function upsertQA(item: Partial<QAItem> & { question: string; answer: string }): Promise<QAItem> {
  const list = await getQA();
  const full: QAItem = {
    id: item.id || `qa-${Date.now().toString(36)}`,
    question: item.question.trim(),
    answer: item.answer.trim(),
    category: (item.category ?? "").trim(),
    product: (item.product ?? "").trim(),
    updatedAt: now(),
  };
  const i = list.findIndex((q) => q.id === full.id);
  if (i >= 0) list[i] = full;
  else list.push(full);
  await saveQA(list);
  return full;
}

export async function deleteQA(id: string) {
  await saveQA((await getQA()).filter((q) => q.id !== id));
}

// ---------- 규칙 ----------
export async function getRules(): Promise<Rules> {
  const raw = await kv.get("rules");
  return raw ? (JSON.parse(raw) as Rules) : { ...DEFAULT_RULES, updatedAt: "" };
}

export async function saveRules(r: Omit<Rules, "updatedAt">): Promise<Rules> {
  const full = { ...r, updatedAt: now() };
  await kv.set("rules", JSON.stringify(full));
  return full;
}
