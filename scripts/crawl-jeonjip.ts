/**
 * dchoi09.com 의 "전집" 카테고리 상품을 상세 페이지까지 수집해서
 * data/jeonjip.xlsx 엑셀 파일로 저장합니다.
 *
 * 실행:  npm run crawl
 *
 * 이미 엑셀에 있는 "질의응답" 시트는 지우지 않고 그대로 유지합니다.
 */

import fs from "node:fs";
import path from "node:path";
import type { Product, QAItem } from "../lib/types";
import { readWorkbook, writeWorkbook } from "../lib/excel";

const SITE = "https://dchoi09.com";
const MAIN_COLLECTION = "series-books-all";
// 연령별 하위 카테고리 (사이트 메뉴 기준)
const AGE_COLLECTIONS: Record<string, string> = {
  "전집-0-1-세": "0-1세",
  "전집-1-2-세": "1-2세",
  "전집-2-3세": "2-3세",
  "전집-3-4세": "3-4세",
  "전집-5세-이상": "5세 이상",
  "전집-프리오더": "프리오더",
};
const EXCEL_PATH = path.join(process.cwd(), "data", "jeonjip.xlsx");
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36" };

interface ShopifyVariant {
  title: string;
  price: string;
  compare_at_price: string | null;
  available: boolean;
  sku: string;
}
interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  tags: string[];
  updated_at: string;
  variants: ShopifyVariant[];
  images: { src: string }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 사이트가 "너무 빨라요"(429) 라고 하면 잠깐 기다렸다가 다시 시도합니다. */
async function politeFetch(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: UA });
    if (res.status !== 429 || attempt >= 6) return res;
    const wait = Number(res.headers.get("retry-after")) * 1000 || 3000 * (attempt + 1);
    await sleep(wait);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

async function listCollection(handle: string): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; page < 20; page++) {
    const url = `${SITE}/collections/${encodeURIComponent(handle)}/products.json?limit=250&page=${page}`;
    const { products } = await getJson<{ products: ShopifyProduct[] }>(url);
    all.push(...products);
    if (products.length < 250) break;
  }
  return all;
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "View Product Details")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** 상품 상세 페이지에서 텍스트 정보(구성, 연령, 수령 안내 등)를 뽑아옵니다. */
async function fetchDetail(handle: string): Promise<string> {
  const res = await politeFetch(`${SITE}/products/${encodeURIComponent(handle)}`);
  if (!res.ok) return "";
  const html = await res.text();
  const blocks = [...html.matchAll(/<div class="metafield-rich_text_field">([\s\S]*?)<\/div>\s*<\/div>/g)];
  return blocks.map((m) => htmlToText(m[1])).join("\n\n").trim();
}

function money(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toProduct(p: ShopifyProduct, ages: string[], detail: string): Product {
  const ship = p.variants.find((v) => !/pick/i.test(v.title)) ?? null;
  const pickup = p.variants.find((v) => /pick/i.test(v.title)) ?? null;
  const options = p.variants
    .map((v) => {
      const cmp = money(v.compare_at_price);
      const price = money(v.price);
      const extra = cmp && price && cmp > price ? ` (정가 $${cmp.toFixed(2)})` : "";
      return `${v.title} $${price?.toFixed(2) ?? "?"}${extra}${v.available ? "" : " [품절]"}`;
    })
    .join(" / ");
  return {
    id: String(p.id),
    title: p.title,
    brand: p.vendor,
    ages,
    tags: p.tags.filter((t) => t !== "전집"),
    shipPrice: money(ship?.price),
    shipCompare: money(ship?.compare_at_price),
    pickupPrice: money(pickup?.price),
    pickupCompare: money(pickup?.compare_at_price),
    options,
    available: p.variants.some((v) => v.available),
    sku: p.variants[0]?.sku ?? "",
    detail,
    url: `${SITE}/products/${p.handle}`,
    image: p.images[0]?.src ?? "",
    updatedAt: p.updated_at,
  };
}

/** 처음 만들 때 넣어 두는 기본 질의응답 (사이트 공통 안내 기준). 관리자 페이지에서 고칠 수 있습니다. */
function starterQA(): QAItem[] {
  const now = new Date().toISOString();
  const rows: [string, string, string][] = [
    ["배송은 얼마나 걸리나요?", "한국에서 미국으로 선박을 통해 국제배송하기 때문에 주문 후 수령까지 최대 2개월이 걸릴 수 있습니다. 상품별 예상 수령 시기는 상세 페이지의 '수령 안내'를 확인해 주세요. 지연이 생기면 미리 안내드립니다.", "배송"],
    ["수령 방법에는 어떤 것이 있나요?", "픽업(가장 저렴, 지정 장소에서 직접 수령), 로컬 배송(픽업 비용 + 추가 배송비), 택배(Shipping, 물류 업체 배송) 세 가지가 있습니다. 상품마다 선택 가능한 옵션이 다르니 상세 페이지를 확인해 주세요.", "배송"],
    ["픽업 주문 전에 확인해야 할 것이 있나요?", "픽업 옵션 선택 시 주문 전에 지역별 재고 확인이 꼭 필요합니다. 지역별 픽업 장소 및 재고 페이지(https://request.dchoisystem.com/inventory_status) 또는 카카오 채널(http://pf.kakao.com/_qDxjEn/chat)로 문의해 주세요.", "픽업"],
    ["주문을 취소할 수 있나요?", "주문 제작 상품이라 단순 변심에 의한 취소는 어렵습니다. 또한 카드 결제 후 결제 취소 시 3% 카드 수수료가 고객님 부담으로 발생합니다.", "취소/반품"],
    ["책이 빠져 있거나 파손되어 왔어요.", "제품 누락 및 불량/파손은 제품 수령 후 14일 이내에 A/S를 신청하셔야 처리 가능합니다. 카카오톡 채널로 사진과 함께 문의해 주세요.", "취소/반품"],
    ["반품 비용은 누가 내나요?", "제품 하자의 경우 반품 비용은 Dchoi09에서 부담합니다. 다만 사용 중 생긴 손상, 경미한 제조사 하자(미세한 색상 차이 등), 운송 중 생긴 작은 손상(스크래치, 덴트 등)은 반품이 어렵습니다.", "취소/반품"],
    ["할인 받을 수 있는 결제 방법이 있나요?", "Zelle로 결제하시면 추가 3% 할인을 받으실 수 있습니다.", "결제"],
    ["픽업 상품과 배송 상품을 같이 결제해도 되나요?", "수령 방법이 같은 상품끼리 결제해 주세요. 예를 들어 픽업할 상품만 골라서 따로 결제하시면 됩니다. 로컬 배송이나 픽업 주문은 주문 완료 후 지역방에 입장해 주세요.", "결제"],
    ["회원가입이 필요한가요?", "네, 주문 시 신규 회원가입이 필수입니다.", "주문"],
    ["상담원과 직접 이야기하고 싶어요.", "카카오 채널(http://pf.kakao.com/_qDxjEn/chat) 또는 채널톡 1:1 문의를 이용해 주세요.", "문의"],
    ["우리 아이 나이에 맞는 전집을 추천해 주세요.", "아이의 개월 수(나이)와 관심사(창작동화, 전래/명작, 수학/과학, 언어/인지 등)를 알려주시면 연령 분류와 상세 정보를 바탕으로 맞는 전집을 추천해 드립니다.", "추천"],
  ];
  return rows.map(([question, answer, category], i) => ({
    id: `qa-${String(i + 1).padStart(3, "0")}`,
    question,
    answer,
    category,
    product: "",
    updatedAt: now,
  }));
}

async function main() {
  console.log("1) 전집 상품 목록 가져오는 중...");
  const products = await listCollection(MAIN_COLLECTION);
  console.log(`   → ${products.length}개`);

  console.log("2) 연령별 분류 가져오는 중...");
  const ageMap = new Map<string, string[]>();
  for (const [handle, label] of Object.entries(AGE_COLLECTIONS)) {
    const list = await listCollection(handle);
    for (const p of list) ageMap.set(p.handle, [...(ageMap.get(p.handle) ?? []), label]);
    console.log(`   ${label}: ${list.length}개`);
    await sleep(1000);
  }

  console.log("3) 상세 페이지 읽는 중 (조금 걸립니다)...");
  const result: Product[] = [];
  const CONCURRENCY = 2;
  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const batch = products.slice(i, i + CONCURRENCY);
    const details = await Promise.all(batch.map((p) => fetchDetail(p.handle).catch(() => "")));
    batch.forEach((p, j) => result.push(toProduct(p, ageMap.get(p.handle) ?? [], details[j])));
    process.stdout.write(`   ${Math.min(i + CONCURRENCY, products.length)}/${products.length}\r`);
    await sleep(700);
  }
  console.log("");

  // 기존 엑셀의 질의응답은 유지
  let qa: QAItem[] = starterQA();
  if (fs.existsSync(EXCEL_PATH)) {
    const existing = await readWorkbook(fs.readFileSync(EXCEL_PATH));
    if (existing.qa.length) qa = existing.qa;
  }

  fs.mkdirSync(path.dirname(EXCEL_PATH), { recursive: true });
  const buf = await writeWorkbook(result, qa);
  fs.writeFileSync(EXCEL_PATH, buf);
  console.log(`4) 저장 완료: ${EXCEL_PATH}`);
  console.log(`   상품 ${result.length}개 / 질의응답 ${qa.length}개`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
