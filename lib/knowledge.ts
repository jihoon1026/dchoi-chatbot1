// 엑셀에서 만든 지식(data/knowledge.json)을 챗봇이 읽기 좋은 글로 바꿉니다.
import knowledge from "@/data/knowledge.json";
import type { Product, QAItem } from "./types";

export const products = knowledge.products as Product[];
export const excelQA = knowledge.qa as QAItem[];

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

/** 상품 목록 전체 글. 엑셀이 바뀌어 다시 배포되기 전까지 똑같아서 프롬프트 캐시가 잘 됩니다. */
export const catalogText = `[전집 상품 목록] (dchoi09.com 전집 카테고리, 총 ${products.length}개)\n\n${products.map(productBlock).join("\n\n")}`;

export function qaText(qa: QAItem[]): string {
  if (!qa.length) return "[질의응답]\n(등록된 항목 없음)";
  return `[질의응답] 운영자가 정한 공식 답변입니다. 같은 뜻의 질문에는 이 답변을 우선으로 따르세요.\n\n${qa
    .map((q) => `Q. ${q.question}${q.product ? ` (관련상품: ${q.product})` : ""}\nA. ${q.answer}`)
    .join("\n\n")}`;
}
