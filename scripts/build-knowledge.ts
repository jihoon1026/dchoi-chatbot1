/**
 * data/jeonjip.xlsx (엑셀) → data/knowledge.json (챗봇이 읽는 파일) 로 변환합니다.
 * npm run dev / npm run build 할 때 자동으로 먼저 실행됩니다.
 */
import fs from "node:fs";
import path from "node:path";
import { readWorkbook } from "../lib/excel";

const src = path.join(process.cwd(), "data", "jeonjip.xlsx");
const out = path.join(process.cwd(), "data", "knowledge.json");

async function main() {
  if (!fs.existsSync(src)) {
    console.error(`엑셀 파일이 없습니다: ${src}\n먼저 npm run crawl 을 실행하세요.`);
    process.exit(1);
  }
  const { products, qa } = await readWorkbook(fs.readFileSync(src));
  fs.writeFileSync(out, JSON.stringify({ products, qa }, null, 1));
  console.log(`지식 파일 생성: 상품 ${products.length}개, 질의응답 ${qa.length}개 → data/knowledge.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
