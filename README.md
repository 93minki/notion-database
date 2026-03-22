## Notion CMS Demo (Next.js)

노션 데이터베이스를 CMS처럼 사용해서 아래 흐름을 테스트하는 샘플입니다.

1. 노션 DB의 페이지(이미지 + 텍스트) 읽어서 화면에 표시
2. 웹 폼으로 입력한 값을 노션 DB에 새 페이지로 추가

## 준비

1. 노션에서 Internal Integration 생성 후 토큰 발급
2. DB 페이지에서 `연결`/`초대`로 Integration에 접근 권한 부여
3. DB ID 확인 후 `.env.local` 작성

`.env.local` 예시:

```bash
NOTION_TOKEN=secret_xxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 실행

```bash
yarn install
yarn dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 열기

## 현재 DB 스키마 가정

- `이름`: title
- `태그`: select 또는 multi_select
- `날짜`: date

코드 기본값도 이 이름을 기준으로 동작합니다. DB 컬럼명이 다르면 [/Users/kimminki/Desktop/work/study/project/notion-database-test/src/lib/notion.ts](/Users/kimminki/Desktop/work/study/project/notion-database-test/src/lib/notion.ts)의 `PROPERTY_NAMES`를 바꿔주세요.

## 구현 파일

- [/Users/kimminki/Desktop/work/study/project/notion-database-test/src/lib/notion.ts](/Users/kimminki/Desktop/work/study/project/notion-database-test/src/lib/notion.ts): 노션 읽기/쓰기 로직
- [/Users/kimminki/Desktop/work/study/project/notion-database-test/src/app/page.tsx](/Users/kimminki/Desktop/work/study/project/notion-database-test/src/app/page.tsx): 조회 UI + 입력 폼 + 서버 액션
