// 챗봇의 지식 = GitHub에 올라간 엑셀 파일(data/jeonjip.xlsx).
// 엑셀을 읽어 상품 목록과 질의응답을 꺼내고, 관리자가 질의응답을 고치면 엑셀에 다시 저장합니다.
import bundled from "@/data/knowledge.json";
import { readWorkbook, writeWorkbook } from "./excel";
import { readFile, storageKind, updateFile } from "./storage";
import type { Product, QAItem } from "./types";

export const EXCEL_PATH = "data/jeonjip.xlsx";
const CACHE_MS = 60_000; // 1분마다 GitHub의 엑셀을 다시 확인

export interface Knowledge {
  products: Product[];
  qa: QAItem[];
  catalog: string;
  source: "github" | "local" | "bundled";
}

let cache: { at: number; k: Knowledge } | null = null;

const usd = (n: number | null) => (n == null ? "-" : `$${n.toFixed(2)}`);

function productBlock(p: Product, i: number): string {
  const lines = [
    `### ${i + 1}. ${p.title}`,
    `- 브랜드: ${p.brand}`,
    `- 연령분류: ${p.ages.join(", ") || "미분류"}`,
    p.tags.length ? `- 태그: ${p.tags.join(", ")}` : "",
    `- 가격: 배송 ${usd(p.shipPrice)}${p.shipCompare && p.shipCompare > (p.shipPrice ?? 0) ? ` (정가 ${usd(p.shipCompare)})` : ""} / 픽업 ${usd(p.pickupPrice)}${p.pickupCompare && p.pickupCompare > (p.pickupPrice ?? 0) ? ` (정가 ${usd(p.pickupCompare)})` : ""}`,
    p.options ? `- 수령방법별 가격: ${p.options}` : "",
    `- 구매가능: ${p.available ? "예" : "아니오(품절)"}`,
    `- 링크: ${p.url}`,
    p.detail ? `- 상세정보:\n${p.detail.split("\n").map((l) => `  ${l}`).join("\n")}` : "- 상세정보: (텍스트 정보 없음, 상세 페이지 이미지 참고)",
  ];
  return lines.filter(Boolean).join("\n");
}

/** 상품 목록 전체 글. 엑셀이 바뀌기 전까지 똑같아서 프롬프트 캐시가 잘 됩니다. */
function catalogText(products: Product[]) {
  return `[전집 상품 목록] (dchoi09.com 전집 카테고리, 총 ${products.length}개)\n\n${products.map(productBlock).join("\n\n")}`;
}

function build(products: Product[], qa: QAItem[], source: Knowledge["source"]): Knowledge {
  return { products, qa, catalog: catalogText(products), source };
}

export async function getKnowledge(): Promise<Knowledge> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.k;
  let k: Knowledge;
  try {
    const file = await readFile(EXCEL_PATH);
    if (!file) throw new Error("엑셀 파일 없음");
    const { products, qa } = await readWorkbook(file.data);
    k = build(products, qa, storageKind === "github" ? "github" : "local");
  } catch (e) {
    console.error("[knowledge] 엑셀을 읽지 못해 내장 데이터로 대신합니다:", e);
    k = cache?.k ?? build(bundled.products as Product[], bundled.qa as QAItem[], "bundled");
  }
  cache = { at: Date.now(), k };
  return k;
}

/** 질의응답 목록을 엑셀(질의응답 시트)에 저장합니다. 상품 시트는 그대로 둡니다. */
export async function saveQAToExcel(qa: QAItem[], message: string) {
  let products: Product[] = [];
  await updateFile(EXCEL_PATH, message, async (current) => {
    products = current ? (await readWorkbook(current)).products : (bundled.products as Product[]);
    return writeWorkbook(products, qa);
  });
  cache = { at: Date.now(), k: build(products, qa, cache?.k.source ?? "local") };
}

/** 엑셀 파일 전체를 새 파일로 바꿉니다 (관리자 "엑셀 올리기"). */
export async function replaceExcel(buf: Buffer) {
  const { products, qa } = await readWorkbook(buf);
  if (!products.length) throw new Error("'전집상품' 시트에서 상품을 찾지 못했어요.");
  await updateFile(EXCEL_PATH, "관리자: 엑셀 파일 교체", () => buf);
  cache = { at: Date.now(), k: build(products, qa, cache?.k.source ?? "local") };
  return { products: products.length, qa: qa.length };
}

export function qaText(qa: QAItem[]): string {
  if (!qa.length) return "[질의응답]\n(등록된 항목 없음)";
  return `[질의응답] 운영자가 정한 공식 답변입니다. 같은 뜻의 질문에는 이 답변을 우선으로 따르세요.\n\n${qa
    .map((q) => `Q. ${q.question}${q.product ? ` (관련상품: ${q.product})` : ""}\nA. ${q.answer}`)
    .join("\n\n")}`;
}
