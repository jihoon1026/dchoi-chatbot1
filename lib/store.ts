// 사용자·대화·질의응답·규칙 저장 (모두 GitHub 레포의 파일)
//   data/chats/<사용자ID>.json : 사용자 정보 + 대화 기록 (한 사람당 파일 하나)
//   data/rules.json           : 챗봇 규칙
//   data/jeonjip.xlsx         : 상품 + 질의응답 (lib/knowledge.ts)
import crypto from "node:crypto";
import { DEFAULT_RULES } from "./defaultRules";
import { getKnowledge, saveQAToExcel } from "./knowledge";
import { listDir, readFile, updateFile } from "./storage";
import type { ChatMessage, ChatUser, QAItem, Rules } from "./types";

const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

// ---------- 사용자 + 대화 ----------
export interface StoredMessage extends ChatMessage {
  sessionId: string;
}
export interface ChatFile {
  user: ChatUser;
  messages: StoredMessage[];
}

const CHAT_DIR = "data/chats";
const chatPath = (id: string) => `${CHAT_DIR}/${id}.json`;

/** 같은 이메일 = 같은 사용자 ID (경고/차단 기록 유지). 파일 이름에 이메일이 그대로 드러나지 않게 암호화된 값을 씁니다. */
export const userIdFromEmail = (email: string) =>
  crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);

function newUser(name: string, email: string): ChatUser {
  return {
    id: userIdFromEmail(email),
    name,
    email: email.trim().toLowerCase(),
    createdAt: now(),
    lastActiveAt: now(),
    warnings: 0,
    blocked: false,
    messageCount: 0,
  };
}

export async function getChat(id: string): Promise<ChatFile | null> {
  const f = await readFile(chatPath(id));
  return f ? (JSON.parse(f.data.toString("utf-8")) as ChatFile) : null;
}

/** 대화 파일을 고쳐서 저장합니다. 파일이 없으면 base 사용자로 새로 만듭니다. */
export async function updateChat(base: ChatUser, change: (f: ChatFile) => void, message = "챗봇 대화 기록") {
  let result: ChatFile | null = null;
  await updateFile(chatPath(base.id), message, (current) => {
    const f: ChatFile = current ? JSON.parse(current.toString("utf-8")) : { user: { ...base }, messages: [] };
    change(f);
    result = f;
    return JSON.stringify(f, null, 1);
  });
  return result as unknown as ChatFile;
}

/** 입장한 사용자 정보. 아직 파일이 없으면 첫 메시지를 보낼 때 만들어집니다 (입장만 해서는 저장하지 않아요). */
export async function getUserForCookie(c: { name: string; email: string }): Promise<ChatUser> {
  const id = userIdFromEmail(c.email);
  const f = await getChat(id);
  return f?.user ?? newUser(c.name || c.email.split("@")[0], c.email);
}

// 관리자 목록용: 파일 버전(sha)이 같으면 다시 받지 않도록 기억해 둡니다.
const userCache = new Map<string, { sha: string; user: ChatUser }>();

export async function listUsers(): Promise<ChatUser[]> {
  const files = (await listDir(CHAT_DIR)).filter((f) => f.name.endsWith(".json"));
  const users: ChatUser[] = [];
  const queue = [...files];
  async function worker() {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const hit = userCache.get(f.path);
      if (hit && hit.sha === f.sha) {
        users.push(hit.user);
        continue;
      }
      const chat = await getChat(f.name.replace(/\.json$/, ""));
      if (chat) {
        userCache.set(f.path, { sha: f.sha, user: chat.user });
        users.push(chat.user);
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  return users.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
}

// ---------- 질의응답 (엑셀의 "질의응답" 시트) ----------
export async function getQA(): Promise<QAItem[]> {
  return (await getKnowledge()).qa;
}

export async function upsertQA(item: Partial<QAItem> & { question: string; answer: string }): Promise<QAItem> {
  const list = [...(await getKnowledge()).qa];
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
  await saveQAToExcel(list, `관리자: 질의응답 ${i >= 0 ? "수정" : "추가"}`);
  return full;
}

export async function deleteQA(id: string) {
  const list = (await getKnowledge()).qa.filter((q) => q.id !== id);
  await saveQAToExcel(list, "관리자: 질의응답 삭제");
}

// ---------- 규칙 ----------
const RULES_PATH = "data/rules.json";
let rulesCache: { at: number; rules: Rules } | null = null;

export async function getRules(): Promise<Rules> {
  if (rulesCache && Date.now() - rulesCache.at < 30_000) return rulesCache.rules;
  const f = await readFile(RULES_PATH);
  const rules: Rules = f ? JSON.parse(f.data.toString("utf-8")) : { ...DEFAULT_RULES, updatedAt: "" };
  rulesCache = { at: Date.now(), rules };
  return rules;
}

export async function saveRules(r: Omit<Rules, "updatedAt">): Promise<Rules> {
  const full: Rules = { response: r.response, mood: r.mood, abuse: r.abuse, block: r.block, updatedAt: now() };
  await updateFile(RULES_PATH, "관리자: 챗봇 규칙 수정", () => JSON.stringify(full, null, 2));
  rulesCache = { at: Date.now(), rules: full };
  return full;
}
