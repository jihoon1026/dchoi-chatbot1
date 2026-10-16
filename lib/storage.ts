// 저장소: 따로 데이터베이스 없이 "GitHub 레포지토리의 파일"에 읽고 씁니다.
// - GITHUB_TOKEN + GITHUB_REPO 가 있으면 → GitHub (Vercel 운영용)
// - 없으면 → 내 컴퓨터의 .data 폴더 (테스트용)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface StoredFile {
  data: Buffer;
  sha: string; // 파일 버전 표시. 저장할 때 "내가 읽은 버전 그대로인지" 확인하는 데 씁니다.
}

/** 다른 요청이 먼저 같은 파일을 바꿔서 저장이 거절된 경우 */
export class ConflictError extends Error {}

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO; // 예: jihoon1026/dchoi-chatbot1
const BRANCH = process.env.GITHUB_BRANCH || "main";
const API = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");

export const storageKind: "github" | "local" | "temp" = TOKEN && REPO ? "github" : process.env.VERCEL ? "temp" : "local";

interface Backend {
  read(p: string): Promise<StoredFile | null>;
  write(p: string, data: Buffer | string, message: string, sha: string | null): Promise<string>;
  list(dir: string): Promise<{ name: string; path: string; sha: string }[]>;
}

// ---------- GitHub ----------
const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

async function gh(url: string, init: RequestInit = {}) {
  return fetch(`${API}${url}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "dchoi-chatbot",
      ...(init.headers ?? {}),
    },
  });
}

const githubBackend: Backend = {
  async read(p) {
    const url = `/repos/${REPO}/contents/${encodePath(p)}?ref=${encodeURIComponent(BRANCH)}`;
    const res = await gh(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub 읽기 실패 (${res.status}) ${p}: ${await res.text()}`);
    const j = (await res.json()) as { sha: string; content?: string; encoding?: string; size: number };
    if (j.content && j.encoding === "base64") return { sha: j.sha, data: Buffer.from(j.content, "base64") };
    // 1MB 넘는 파일은 내용이 비어서 오므로 원본으로 한 번 더 받습니다.
    const raw = await gh(url, { headers: { Accept: "application/vnd.github.raw+json" } });
    if (!raw.ok) throw new Error(`GitHub 읽기 실패 (${raw.status}) ${p}`);
    return { sha: j.sha, data: Buffer.from(await raw.arrayBuffer()) };
  },
  async write(p, data, message, sha) {
    const body: Record<string, string> = {
      message,
      content: Buffer.from(data).toString("base64"),
      branch: BRANCH,
    };
    if (sha) body.sha = sha;
    const res = await gh(`/repos/${REPO}/contents/${encodePath(p)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409 || (res.status === 422 && /sha/i.test(await res.clone().text()))) {
      throw new ConflictError(`${p} 가 다른 곳에서 먼저 바뀌었습니다`);
    }
    if (!res.ok) throw new Error(`GitHub 저장 실패 (${res.status}) ${p}: ${await res.text()}`);
    const j = (await res.json()) as { content: { sha: string } };
    return j.content.sha;
  },
  async list(dir) {
    const res = await gh(`/repos/${REPO}/contents/${encodePath(dir)}?ref=${encodeURIComponent(BRANCH)}`);
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`GitHub 목록 실패 (${res.status}) ${dir}`);
    const j = (await res.json()) as { type: string; name: string; path: string; sha: string }[];
    return Array.isArray(j) ? j.filter((f) => f.type === "file").map(({ name, path, sha }) => ({ name, path, sha })) : [];
  },
};

// ---------- 내 컴퓨터 (.data 폴더) ----------
// 쓰기는 .data/ 아래에만 합니다. 읽을 때 .data 에 없으면 프로젝트의 원본 파일(예: data/jeonjip.xlsx)을 읽습니다.
const localRoot = storageKind === "temp" ? "/tmp/dchoi" : path.join(/*turbopackIgnore: true*/ process.cwd(), ".data");
const hash = (b: Buffer) => crypto.createHash("sha1").update(b).digest("hex");

const localBackend: Backend = {
  async read(p) {
    for (const full of [path.join(localRoot, p), path.join(/*turbopackIgnore: true*/ process.cwd(), p)]) {
      try {
        const data = fs.readFileSync(full);
        return { data, sha: hash(data) };
      } catch {
        /* 다음 위치 확인 */
      }
    }
    return null;
  },
  async write(p, data, _message, sha) {
    const current = await localBackend.read(p);
    if ((current?.sha ?? null) !== (sha ?? null)) throw new ConflictError(`${p} 가 먼저 바뀌었습니다`);
    const full = path.join(localRoot, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    const buf = Buffer.from(data);
    fs.writeFileSync(full, buf);
    return hash(buf);
  },
  async list(dir) {
    const full = path.join(localRoot, dir);
    if (!fs.existsSync(full)) return [];
    return fs
      .readdirSync(full)
      .filter((n) => fs.statSync(path.join(full, n)).isFile())
      .map((name) => ({ name, path: `${dir}/${name}`, sha: hash(fs.readFileSync(path.join(full, name))) }));
  },
};

const backend = storageKind === "github" ? githubBackend : localBackend;

export const readFile = (p: string) => backend.read(p);
export const writeFile = (p: string, data: Buffer | string, message: string, sha: string | null) =>
  backend.write(p, data, message, sha);
export const listDir = (dir: string) => backend.list(dir);

/** 읽고 → 고치고 → 저장. 그 사이 다른 요청이 먼저 저장했으면 다시 읽어서 최대 4번 재시도합니다. */
export async function updateFile(
  p: string,
  message: string,
  change: (current: Buffer | null) => Buffer | string | null | Promise<Buffer | string | null>,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const current = await readFile(p);
    const next = await change(current?.data ?? null);
    if (next === null) return; // 바꿀 것 없음
    try {
      await writeFile(p, next, message, current?.sha ?? null);
      return;
    } catch (e) {
      if (!(e instanceof ConflictError) || attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
}
