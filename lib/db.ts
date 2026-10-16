// 저장소: Vercel에 Upstash Redis가 연결돼 있으면 Redis를, 아니면 내 컴퓨터의 .data/db.json 파일을 씁니다.
import { Redis } from "@upstash/redis";
import fs from "node:fs";
import path from "node:path";

interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  rpush(key: string, value: string): Promise<void>;
  lrange(key: string): Promise<string[]>;
}

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const storageKind: "redis" | "file" | "temp-file" = redisUrl && redisToken ? "redis" : process.env.VERCEL ? "temp-file" : "file";

function redisKV(): KV {
  const r = new Redis({ url: redisUrl!, token: redisToken!, automaticDeserialization: false });
  return {
    get: (k) => r.get<string>(k),
    set: async (k, v) => void (await r.set(k, v)),
    hget: (k, f) => r.hget<string>(k, f),
    hset: async (k, f, v) => void (await r.hset(k, { [f]: v })),
    hgetall: async (k) => (await r.hgetall<Record<string, string>>(k)) ?? {},
    rpush: async (k, v) => void (await r.rpush(k, v)),
    lrange: (k) => r.lrange<string>(k, 0, -1),
  };
}

type FileData = { kv: Record<string, string>; hash: Record<string, Record<string, string>>; list: Record<string, string[]> };

function fileKV(): KV {
  // Vercel 서버는 /tmp 에만 쓸 수 있고, 그마저도 금방 지워집니다 → Redis 연결을 꼭 하세요.
  const dir = storageKind === "temp-file" ? "/tmp" : path.join(process.cwd(), ".data");
  const file = path.join(dir, "db.json");
  const load = (): FileData => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      return { kv: {}, hash: {}, list: {} };
    }
  };
  const save = (d: FileData) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(d, null, 1));
  };
  return {
    get: async (k) => load().kv[k] ?? null,
    set: async (k, v) => {
      const d = load();
      d.kv[k] = v;
      save(d);
    },
    hget: async (k, f) => load().hash[k]?.[f] ?? null,
    hset: async (k, f, v) => {
      const d = load();
      (d.hash[k] ??= {})[f] = v;
      save(d);
    },
    hgetall: async (k) => load().hash[k] ?? {},
    rpush: async (k, v) => {
      const d = load();
      (d.list[k] ??= []).push(v);
      save(d);
    },
    lrange: async (k) => load().list[k] ?? [],
  };
}

export const kv: KV = storageKind === "redis" ? redisKV() : fileKV();
