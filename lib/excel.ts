// 엑셀(jeonjip.xlsx) 읽기/쓰기. 크롤러, 지식 빌드 스크립트, 관리자 다운로드/업로드에서 함께 씁니다.
import ExcelJS from "exceljs";
import type { Product, QAItem } from "./types";

export const PRODUCT_SHEET = "전집상품";
export const QA_SHEET = "질의응답";

type Col<T> = { header: string; key: keyof T; width: number };

export const PRODUCT_COLUMNS: Col<Product>[] = [
  { header: "상품ID", key: "id", width: 16 },
  { header: "상품명", key: "title", width: 45 },
  { header: "브랜드", key: "brand", width: 14 },
  { header: "연령분류", key: "ages", width: 18 },
  { header: "태그", key: "tags", width: 24 },
  { header: "배송가(USD)", key: "shipPrice", width: 12 },
  { header: "배송정가(USD)", key: "shipCompare", width: 13 },
  { header: "픽업가(USD)", key: "pickupPrice", width: 12 },
  { header: "픽업정가(USD)", key: "pickupCompare", width: 13 },
  { header: "수령방법별가격", key: "options", width: 50 },
  { header: "구매가능", key: "available", width: 9 },
  { header: "SKU", key: "sku", width: 26 },
  { header: "상세정보", key: "detail", width: 80 },
  { header: "상품URL", key: "url", width: 50 },
  { header: "이미지URL", key: "image", width: 40 },
  { header: "업데이트", key: "updatedAt", width: 22 },
];

export const QA_COLUMNS: Col<QAItem>[] = [
  { header: "ID", key: "id", width: 10 },
  { header: "질문", key: "question", width: 45 },
  { header: "답변", key: "answer", width: 90 },
  { header: "분류", key: "category", width: 12 },
  { header: "관련상품", key: "product", width: 30 },
  { header: "수정일", key: "updatedAt", width: 22 },
];

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result ?? "");
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}

const num = (s: string) => (s.trim() === "" || isNaN(Number(s)) ? null : Number(s));
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function readSheet(ws: ExcelJS.Worksheet | undefined): Record<string, string>[] {
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell((c, i) => (headers[i] = cellText(c.value).trim()));
  const rows: Record<string, string>[] = [];
  ws.eachRow((row, r) => {
    if (r === 1) return;
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => h && (obj[h] = cellText(row.getCell(i).value)));
    if (Object.values(obj).some((v) => v.trim())) rows.push(obj);
  });
  return rows;
}

export async function readWorkbook(data: ArrayBuffer | Buffer): Promise<{ products: Product[]; qa: QAItem[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as ArrayBuffer);
  const h = (c: Col<Product>) => c.header;
  const P = Object.fromEntries(PRODUCT_COLUMNS.map((c) => [c.key, h(c)])) as Record<keyof Product, string>;
  const Q = Object.fromEntries(QA_COLUMNS.map((c) => [c.key, c.header])) as Record<keyof QAItem, string>;

  const products: Product[] = readSheet(wb.getWorksheet(PRODUCT_SHEET)).map((r) => ({
    id: r[P.id] ?? "",
    title: r[P.title] ?? "",
    brand: r[P.brand] ?? "",
    ages: list(r[P.ages] ?? ""),
    tags: list(r[P.tags] ?? ""),
    shipPrice: num(r[P.shipPrice] ?? ""),
    shipCompare: num(r[P.shipCompare] ?? ""),
    pickupPrice: num(r[P.pickupPrice] ?? ""),
    pickupCompare: num(r[P.pickupCompare] ?? ""),
    options: r[P.options] ?? "",
    available: !/^(n|no|false|x|품절|0)$/i.test((r[P.available] ?? "").trim()),
    sku: r[P.sku] ?? "",
    detail: r[P.detail] ?? "",
    url: r[P.url] ?? "",
    image: r[P.image] ?? "",
    updatedAt: r[P.updatedAt] ?? "",
  }));

  const qa: QAItem[] = readSheet(wb.getWorksheet(QA_SHEET)).map((r, i) => ({
    id: r[Q.id] || `qa-${String(i + 1).padStart(3, "0")}`,
    question: r[Q.question] ?? "",
    answer: r[Q.answer] ?? "",
    category: r[Q.category] ?? "",
    product: r[Q.product] ?? "",
    updatedAt: r[Q.updatedAt] ?? "",
  })).filter((q) => q.question.trim() && q.answer.trim());

  return { products, qa };
}

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5D50" } };
  row.alignment = { vertical: "middle" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

export async function writeWorkbook(products: Product[], qa: QAItem[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "dchoi-chatbot";

  const ps = wb.addWorksheet(PRODUCT_SHEET);
  ps.columns = PRODUCT_COLUMNS.map((c) => ({ header: c.header, key: c.key as string, width: c.width }));
  for (const p of products) {
    ps.addRow({
      ...p,
      ages: p.ages.join(", "),
      tags: p.tags.join(", "),
      available: p.available ? "Y" : "N",
    });
  }
  ps.getColumn("detail").alignment = { wrapText: true, vertical: "top" };
  styleHeader(ps);

  const qs = wb.addWorksheet(QA_SHEET);
  qs.columns = QA_COLUMNS.map((c) => ({ header: c.header, key: c.key as string, width: c.width }));
  for (const q of qa) qs.addRow(q);
  qs.getColumn("answer").alignment = { wrapText: true, vertical: "top" };
  styleHeader(qs);

  const guide = wb.addWorksheet("사용법");
  guide.getColumn(1).width = 110;
  [
    "이 엑셀 파일은 챗봇이 공부하는 '지식 파일'입니다.",
    "",
    `■ ${PRODUCT_SHEET} 시트: dchoi09.com 전집 카테고리 상품 정보 (npm run crawl 로 다시 수집할 수 있어요)`,
    `■ ${QA_SHEET} 시트: 자주 묻는 질문과 정해진 답변. 챗봇은 여기 있는 답변을 가장 먼저 따릅니다.`,
    "",
    "· 첫 줄(제목 줄)의 이름은 바꾸지 마세요. 챗봇이 칸 이름으로 내용을 찾습니다.",
    "· 질의응답은 관리자 페이지에서 바로 추가/수정/삭제할 수 있고, 거기서 엑셀로 다시 내려받을 수도 있어요.",
    "· 연령분류, 태그 칸은 쉼표(,)로 구분합니다.",
  ].forEach((t) => guide.addRow([t]));

  return Buffer.from(await wb.xlsx.writeBuffer());
}
