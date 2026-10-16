// 챗봇 전체에서 함께 쓰는 데이터 모양(타입) 정의

export interface Product {
  id: string; // Shopify 상품 ID
  title: string; // 상품명
  brand: string; // 브랜드(출판사)
  ages: string[]; // 연령 분류 (예: "전집 1-2세")
  tags: string[]; // 사이트 태그 (창작동화, 전래/명작 ...)
  shipPrice: number | null; // 배송 판매가 (USD)
  shipCompare: number | null; // 배송 정가 (USD)
  pickupPrice: number | null; // 픽업 판매가 (USD)
  pickupCompare: number | null; // 픽업 정가 (USD)
  options: string; // 수령 방법별 가격 요약 (예: "Shipping $68.04 / Pick-up $59.79")
  available: boolean; // 구매 가능 여부
  sku: string;
  detail: string; // 상세 페이지의 텍스트 정보 (구성, 연령, 수령 안내 등)
  url: string; // 상품 상세 페이지 주소
  image: string; // 대표 이미지 주소
  updatedAt: string;
}

export interface QAItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  product: string; // 관련 상품명 (없으면 빈 칸)
  updatedAt: string;
}

export interface Rules {
  response: string; // 응대 규칙
  mood: string; // 사용자 기분 파악 규칙
  abuse: string; // 이상 사용자 판별 및 경고 규칙
  block: string; // 차단 규칙
  updatedAt: string;
}

export type Mood = "긍정" | "보통" | "불만" | "화남" | "불안" | "혼란";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "warning" | "system";
  content: string;
  createdAt: string;
  mood?: string; // 사용자 메시지에 대한 기분 판정
  flag?: "none" | "warn" | "block"; // 이상 사용자 판정 결과
  flagReason?: string;
}

export interface ChatUser {
  id: string; // 이메일 기반 ID
  name: string;
  email: string;
  createdAt: string;
  lastActiveAt: string;
  warnings: number;
  blocked: boolean;
  blockedReason?: string;
  lastMood?: string;
  messageCount: number;
}
