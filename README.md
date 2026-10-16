# DCHOI09 전집 상담 챗봇

dchoi09.com 의 **전집** 상품(153개, 상세 페이지 정보 포함)을 엑셀로 정리해 두고,
Claude **Sonnet 5.5** 가 그 엑셀을 보고 손님 질문에 답하는 챗봇입니다.
**데이터베이스 없이** 엑셀·대화 기록·규칙을 모두 **GitHub 레포의 파일**로 저장합니다.

| 주소 | 누가 쓰나요 | 하는 일 |
|---|---|---|
| `/` | 손님 | 이름 + 이메일 입력 → 챗봇과 대화 |
| `/admin` | 운영자 | 대화 기록(사람별), 질의응답 추가/수정/삭제, 챗봇 규칙 4가지 수정, 상품 목록·엑셀 |

### GitHub 에 저장되는 파일

| 파일 | 내용 | 누가 바꾸나요 |
|---|---|---|
| `data/jeonjip.xlsx` | ⭐ 상품 목록 + 질의응답 (챗봇의 지식) | 크롤러, 관리자 페이지(질의응답·엑셀 올리기) |
| `data/rules.json` | 챗봇 규칙 4가지 | 관리자 페이지(규칙) |
| `data/chats/<번호>.json` | 손님 한 명의 정보 + 대화 기록 | 챗봇이 자동으로 |

챗봇은 GitHub의 엑셀을 **1분마다** 다시 읽어요. 그래서 GitHub에서 엑셀을 직접 바꿔도 1분 안에 반영돼요.

---

## 🧒 내가 할 일 (순서대로 따라 하세요)

### 1단계. API 키 넣기 (내 컴퓨터) ✅ 완료

`.env` 파일의 `ANTHROPIC_API_KEY=` 뒤에 Anthropic API 키가 들어 있어야 해요.

### 2단계. 레포지토리를 "비공개(Private)"로 바꾸기 ⚠️ 꼭!

대화 기록에는 손님 **이름·이메일·대화 내용**이 들어가요. 레포가 공개(Public)면 누구나 볼 수 있어요.

1. https://github.com/jihoon1026/dchoi-chatbot1 → 위쪽 **Settings**
2. 맨 아래 **Danger Zone** → **Change repository visibility** → **Make private** → 확인

### 3단계. GitHub 토큰 만들기 (챗봇이 GitHub에 저장할 수 있게 해 주는 열쇠)

1. https://github.com/settings/personal-access-tokens/new 접속
2. **Token name**: `dchoi-chatbot` / **Expiration**: 원하는 기간 (예: 1 year)
3. **Repository access** → **Only select repositories** → `dchoi-chatbot1` 선택
4. **Permissions** → **Repository permissions** → **Contents** 를 **Read and write** 로
5. 맨 아래 **Generate token** → 나온 토큰(`github_pat_...`)을 **복사**
6. 내 컴퓨터 `.env` 파일의 `GITHUB_TOKEN=` 뒤에 붙여넣고 저장 (내 컴퓨터에서도 GitHub에 저장하고 싶을 때만)

> ⚠️ 토큰도 비밀번호처럼 다른 사람에게 보여주면 안 돼요.

### 4단계. Vercel 에 연결하기 (인터넷에 공개)

1. https://vercel.com → **Sign Up** → **Continue with GitHub**
2. **Add New… → Project** → `dchoi-chatbot1` 옆 **Import**
3. **Environment Variables** 에 아래를 하나씩 추가 (값은 `.env` 파일과 3단계 토큰)

   | Key (이름) | Value (값) |
   |---|---|
   | `ANTHROPIC_API_KEY` | `.env` 의 값 |
   | `ADMIN_PASSWORD` | `.env` 의 값 |
   | `SESSION_SECRET` | `.env` 의 값 |
   | `GITHUB_TOKEN` | 3단계에서 만든 토큰 |
   | `GITHUB_REPO` | `jihoon1026/dchoi-chatbot1` |

4. **Deploy** 클릭 → 1~2분 뒤 `https://...vercel.app` 주소가 생겨요 🎉
5. 이미 Vercel 프로젝트를 만들었다면: 프로젝트 → **Settings → Environment Variables** 에 `GITHUB_TOKEN`, `GITHUB_REPO` 를 추가하고 **Deployments → ⋯ → Redeploy**

관리자 페이지 > 대화 기록 위에 "대화 기록은 GitHub 레포의 data/chats 폴더에 저장돼요" 라고 나오면 성공이에요.
(Redis / Upstash 는 이제 필요 없어요.)

### 5단계. 앞으로는?

- **코드를 GitHub 에 올리면 Vercel 이 알아서 새로 배포**해요.
- 챗봇이 대화 기록을 저장할 때는 새로 배포하지 않아요 (`vercel.json` 설정).
- 상품 정보 새로 받기: 터미널에서 `npm run crawl` (`.env` 에 GITHUB_TOKEN 이 있으면 GitHub의 엑셀까지 자동으로 바뀌어요)
- 질의응답·규칙 바꾸기: 관리자 페이지에서 바로

---

## 🛠 내 컴퓨터에서 켜 보기

```bash
npm run dev
```
- http://localhost:3000 → 손님 화면 / http://localhost:3000/admin → 관리자 화면 (비밀번호: `.env` 의 `ADMIN_PASSWORD`)
- `.env` 에 `GITHUB_TOKEN` 이 비어 있으면 대화 기록은 `.data` 폴더에만 저장돼요 (GitHub에 안 올라감).

## 📁 코드 구조

| 파일 | 설명 |
|---|---|
| `lib/storage.ts` | GitHub 파일 읽기/쓰기 (토큰 없으면 `.data` 폴더) |
| `lib/knowledge.ts` | GitHub의 엑셀 읽기(1분 캐시), 질의응답 저장 |
| `lib/store.ts` | 사용자·대화·규칙 저장 |
| `lib/ai.ts` | Claude 호출 (① 기분/이상행동 분석 ② 답변 생성) |
| `lib/defaultRules.ts` | 챗봇 규칙 처음 값 |
| `scripts/crawl-jeonjip.ts` | dchoi09.com 전집 카테고리 + 상세 페이지 수집 → 엑셀 |
| `app/page.tsx` | 손님 채팅 화면 |
| `app/admin/page.tsx` | 관리자 화면 |
| `app/globals.css` | 디자인 (DESIGN.md 기준: 검은 바탕, 대문자 자간, 세리프 본문, 모노 버튼) |

## ⚙️ 알아 두면 좋은 것

- 손님 메시지 1개 = GitHub 커밋 1개 (대화 파일 저장). GitHub는 저장(커밋) 횟수에 시간당 한도가 있어서, **한 시간에 수백 건 이상** 대화가 몰리면 저장이 늦어지거나 실패할 수 있어요. 손님이 아주 많아지면 그때 데이터베이스를 고려하세요.
- 같은 이메일로 다시 들어오면 같은 사람으로 묶여서 경고/차단 기록이 유지돼요.
- 상품 목록(약 9만 자)은 프롬프트 캐시로 재사용돼서 비용이 줄어요.
- 안전 필터가 답변을 거절하면 Anthropic 추천 모델로 자동 재시도(`fallbacks: "default"`)해요.
