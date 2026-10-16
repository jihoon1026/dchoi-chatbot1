# 디초이 전집 상담 챗봇

dchoi09.com 의 **전집** 상품(153개, 상세 페이지 정보 포함)을 엑셀로 정리해 두고,
Claude **Sonnet 5.5** 가 그 엑셀을 보고 손님 질문에 답하는 챗봇입니다.

| 주소 | 누가 쓰나요 | 하는 일 |
|---|---|---|
| `/` | 손님 | 이름 + 이메일 입력 → 챗봇과 대화 |
| `/admin` | 운영자 | 대화 기록(사람별), 질의응답 추가/수정/삭제, 챗봇 규칙 4가지 수정, 상품 목록·엑셀 |

---

## 🧒 내가 할 일 (순서대로 따라 하세요)

### 1단계. API 키 넣기 (내 컴퓨터)

1. https://platform.claude.com 에 로그인 → 왼쪽 메뉴 **API Keys** → **Create Key** 클릭
2. 나온 키(`sk-ant-...` 로 시작)를 **복사**
3. 이 폴더의 **`.env`** 파일을 메모장으로 열기
4. `ANTHROPIC_API_KEY=` 바로 뒤에 붙여넣기 → **저장**
   ```
   ANTHROPIC_API_KEY=sk-ant-여기에붙여넣기
   ```
5. 같은 파일의 `ADMIN_PASSWORD=` 뒤에는 관리자 비밀번호가 미리 들어 있어요. 원하면 바꿔도 돼요.

> ⚠️ `.env` 파일은 비밀 금고예요. 다른 사람에게 보내거나 GitHub에 올리면 안 돼요. (자동으로 안 올라가게 설정해 뒀어요)

### 2단계. 내 컴퓨터에서 켜 보기

1. 이 폴더에서 터미널을 열고 아래 한 줄 입력 → Enter
   ```bash
   npm run dev
   ```
2. 인터넷 창에서 http://localhost:3000 → 손님 화면
3. http://localhost:3000/admin → 관리자 화면 (비밀번호는 `.env` 의 `ADMIN_PASSWORD`)
4. 끄고 싶으면 터미널에서 `Ctrl + C`

### 3단계. GitHub 에 올리기 (코드 보관함)

GitHub 레포지토리(https://github.com/jihoon1026/dchoi-chatbot1)와 이미 연결돼 있어요.
코드를 바꾼 뒤 다시 올릴 때는 터미널에서:
```bash
git add -A
git commit -m "바꾼 내용 한 줄 설명"
git push
```
(Claude 에게 "깃허브에 올려줘" 라고 해도 됩니다.)

### 4단계. Vercel 에 연결하기 (인터넷에 공개)

1. https://vercel.com → **Sign Up** → **Continue with GitHub** (GitHub 계정으로 가입)
2. 화면 오른쪽 위 **Add New… → Project**
3. 목록에서 **dchoi-chatbot1** 옆 **Import** 클릭
4. **Environment Variables** 칸을 펼쳐서 아래 3개를 하나씩 추가 (값은 내 `.env` 파일에서 복사)

   | Key (이름) | Value (값) |
   |---|---|
   | `ANTHROPIC_API_KEY` | `.env` 의 값 |
   | `ADMIN_PASSWORD` | `.env` 의 값 |
   | `SESSION_SECRET` | `.env` 의 값 |

5. **Deploy** 클릭 → 1~2분 기다리면 `https://dchoi-chatbot1-xxxx.vercel.app` 주소가 생겨요 🎉

### 5단계. 대화 저장소(Redis) 연결하기 — 꼭 하세요!

Vercel 서버는 파일을 오래 저장하지 못해서, 대화 기록·질의응답·규칙을 보관할 **저장소**가 필요해요. (무료)

1. Vercel 에서 내 프로젝트 클릭 → 위쪽 **Storage** 탭
2. **Create Database** → **Upstash** (Redis) 선택 → **Continue**
3. 무료 요금제(Free) 선택 → 이름은 아무거나 → **Create**
4. "Connect to project" 화면에서 **dchoi-chatbot1** 선택 → **Connect**
5. 위쪽 **Deployments** 탭 → 맨 위 배포 오른쪽 **⋯** → **Redeploy**

연결이 안 되어 있으면 관리자 페이지에 노란색 경고가 떠요.

### 6단계. 앞으로는?

- **GitHub 에 올리기만 하면 Vercel 이 알아서 새로 배포**해요. (3단계 → 자동으로 4단계)
- 상품 정보 새로 받기: 터미널에서 `npm run crawl` → GitHub 에 올리기
- 질의응답·규칙 바꾸기: 관리자 페이지에서 바로 (배포 필요 없음)

---

## 📁 무엇이 어디 있나요

| 파일 | 설명 |
|---|---|
| `data/jeonjip.xlsx` | ⭐ 챗봇이 공부하는 엑셀 (전집상품 / 질의응답 / 사용법 시트) |
| `data/knowledge.json` | 엑셀을 챗봇용으로 바꾼 파일 (자동 생성) |
| `scripts/crawl-jeonjip.ts` | dchoi09.com 전집 카테고리 + 상세 페이지 수집 → 엑셀 |
| `lib/ai.ts` | Claude 호출 (① 기분/이상행동 분석 ② 답변 생성) |
| `lib/defaultRules.ts` | 챗봇 규칙 처음 값 (응대 / 기분 파악 / 경고 / 차단) |
| `app/page.tsx` | 손님 채팅 화면 |
| `app/admin/page.tsx` | 관리자 화면 |

## ⚙️ 동작 방식 (조금 더 자세히)

1. 손님이 메시지를 보내면 먼저 **분석**: 기분(긍정/보통/불안/혼란/불만/화남), 경고·차단 여부를 규칙대로 판정
2. 차단이면 대화 중단, 경고면 경고문 표시 + 경고 횟수 +1
3. **답변**: 상품 목록 전체 + 질의응답 + 응대 규칙 + 분석 결과를 Claude 에게 주고 답을 받음
4. 모든 메시지와 판정 결과는 저장되어 관리자 페이지에서 사람별로 볼 수 있음

- 상품 목록(약 9만 자)은 **프롬프트 캐시**로 재사용돼서, 같은 내용을 반복해 보낼 때 비용이 크게 줄어요.
- 안전 필터가 답변을 거절하면 Anthropic 추천 모델로 자동 재시도(`fallbacks: "default"`)하도록 켜 두었어요.
- 같은 이메일로 다시 들어오면 같은 사람으로 묶여서 경고/차단 기록이 유지돼요. 화면에는 새 대화로 시작해요.
