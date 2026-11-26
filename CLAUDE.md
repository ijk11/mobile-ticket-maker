# 모바일 티켓 메이커 — 작업 규약

배경 사진 + 아래쪽에 흐르는 글자로 모바일 티켓을 디자인하는 PWA. GitHub Pages에 그대로 올려 쓴다.

## 설계 규약

- **폰이 먼저다.** 900px 이하가 기본 사용 환경이다. 화면은 〈위: 실시간 미리보기 — 손잡이 — 아래: 탭 바〉 구조이고,
  데스크톱은 같은 내용을 2단(편집기 | 폰 프레임)으로 보여 주는 변형일 뿐이다. 새 기능은 폰 화면에서 먼저 확인한다.
- **의존성 없는 단일 HTML.** 앱 전체가 `index.html` 하나(HTML+CSS+JS)다. 빌드·npm·번들러를 넣지 않는다.
- **외부 CDN 금지.** 글꼴도 시스템 글꼴만 쓴다. 라이브러리가 꼭 필요하면 `assets/` 에 사본을 두고 상대 경로로 부른다.
- **상대 경로만.** Pages 하위 경로(`/<repo>/`)에서 그대로 열려야 한다. `manifest.webmanifest` 의 `start_url`·`scope` 도 `./`.
- **데이터는 기기 안에서만.** 사진과 입력값은 IndexedDB에만 넣고 밖으로 보내지 않는다.
- **화면 문구는 한국어.** 대상은 최신 모바일 크롬/사파리와 데스크톱 Edge/Chrome.
- 커밋 메시지는 변경 내용만 적는다(프로그램명은 넣지 않음). 배포본은 `git tag -a vX.Y`.
- 커밋 작성자는 `Claude <noreply@anthropic.com>`.

## 구조

| 파일 | 하는 일 |
| --- | --- |
| `index.html` | 상태 모델 · IndexedDB 저장 · 렌더링 · 흐르는 글자 · 전체화면 미리보기 |
| `sw.js` | 앱 껍데기 캐시 (stale-while-revalidate). 파일을 늘리면 `SHELL` 과 `VERSION` 을 함께 고친다 |
| `manifest.webmanifest` | 설치 정보 |
| `tools/make-icons.mjs` | 아이콘 PNG를 코드로 그린다 (`node tools/make-icons.mjs`) |
| `tools/serve.mjs` | 로컬 확인용 정적 서버 (`node tools/serve.mjs`) |

## 고칠 때 주의할 점

- **흐르는 글자**는 `.mq-track` 안에 똑같은 `.mq-half` 두 벌을 넣고 `translateX(-50%)` 로 돌린다.
  이음매가 보이지 않으려면 두 벌의 너비가 정확히 같아야 하므로, 한 벌을 만든 뒤 `cloneNode(true)` 로 복제한다.
- 글꼴·크기가 바뀌면 너비가 달라지므로 `REBUILD` 집합에 넣어 다시 깐다. **`render()` 로 스타일을 먼저 반영한 뒤**
  `buildMarquee()` 를 불러야 너비를 제대로 잰다.
- 폰 프레임은 CSS `transform: scale()` 로 줄여 놓았다. `getBoundingClientRect()` 값은 배율이 섞여 있으므로
  `offsetWidth` 로 나눠 되돌린 뒤 속도를 계산한다. 안 그러면 미리보기와 전체화면의 속도가 달라진다.
- 시계는 1초마다 `.mq-clock` 의 글자만 갈아끼운다. 트랙을 다시 만들면 애니메이션이 튄다.
  자릿수가 흔들리지 않게 `font-variant-numeric: tabular-nums` 를 유지한다.
- **격자 칸에 `1fr` 을 그냥 쓰지 말 것.** `1fr` 은 `minmax(auto,1fr)` 이고 auto 의 최소값은 min-content 라,
  `width:max-content` 인 흐르는 글자 트랙이 칸 너비를 통째로 밀어내 티켓이 화면 밖으로 나간다
  (실제로 폭 375 자리가 2616px이 됐다). `minmax(0,1fr)` 로 쓰고, 미리보기 안쪽 요소에는 `min-width:0; min-height:0` 을 준다.
- 기기 안전영역(노치·홈 인디케이터)은 **전체화면일 때만** 쓴다(`#fsStage .ticket`). 작은 미리보기에 넣으면 빈 띠만 생긴다.
  위는 `--tk-inset-top`, 아래는 `--tk-inset-bot` 으로 모아 뒀다.
- 미리보기 띠가 짧으면 `.tk-head` 가 카드 위로 비어져 나오므로 `overflow:hidden` 을 유지한다.
- 입력칸 글자는 16px 밑으로 내리지 않는다. 그보다 작으면 iOS 사파리가 입력할 때 화면을 확대한다.
- 숨김은 `hidden` 속성으로 하되, `.btn-row { display:flex }` 같은 작성자 스타일이 UA의 `[hidden]` 을 이기므로
  `[hidden]{display:none !important}` 규칙을 지운 채로 두지 않는다.
- 노치/상태표시줄 자리는 `--tk-inset-top` + `env(safe-area-inset-top)` 으로 잡는다. 상단바를 끄면 `.no-top` 이 대신 받는다.
- 서비스워커는 `file://` 과 일부 내장 브라우저에서는 등록되지 않는다. 확인은 `tools/serve.mjs` + 실제 크롬에서 한다.
