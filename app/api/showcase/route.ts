// 입장 화면 상단 사진용: 판매 중인 전집 대표 이미지 4장
import { getKnowledge } from "@/lib/knowledge";

export async function GET(req: Request) {
  void req; // 요청마다 새로 고르기 (빌드 때 고정하지 않음)
  const { products } = await getKnowledge();
  const picks = products.filter((p) => p.available && p.image).slice(0, 4);
  return Response.json({ images: picks.map((p) => ({ src: p.image, title: p.title })) });
}
