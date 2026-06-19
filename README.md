# Infra Setting Planner

서버 자원 목록과 TOBE 인프라 구성도를 시각적으로 편집하는 React 기반 도구입니다.

## 주요 기능

- 좌측 서버 리스트에서 서버를 선택해 TOBE 노드에 할당
- API, DB, Gateway, Secrets, Batch, 영역 노드 추가
- 노드/영역 멀티 선택, 정렬, 크기 통일, 영역 최적화
- 노드 및 연결선 우클릭 편집
- 구성도 JSON 다운로드/업로드
- 서버 리스트 Excel 다운로드/업로드/양식 다운로드
- 구성도 이미지, Mermaid chart, PDF 내보내기

## 실행

```bash
npm install
npm run dev
```

## 서버 목록 재생성

루트의 `서버자원_팀별분류.xlsx` 파일을 기준으로 `public/data/servers.json`을 다시 생성합니다.

```bash
npm run extract:servers
```

## 빌드

```bash
npm run build
```

빌드 결과물은 `dist/`에 생성되며, NAS나 Docker에서는 정적 파일로 서빙하면 됩니다.
