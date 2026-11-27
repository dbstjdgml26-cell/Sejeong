# 성희의 합동 비서실 · PICKLE MOTORS SHOWROOM

피클들이 함께 쓰는 실시간 합동 비서실입니다. 따뜻한 클레이 자동차 전시장 맵 위에 각자의 캐릭터가 자리를 잡고,
회의실에서 `@이름` 멘션으로 이야기하고, 작업실에서 할 일을 함께 굴립니다.

- **호스팅**: GitHub Pages (정적 파일, 빌드 없음) — `https://dbstjdgml26-cell.github.io/Sejeong/`
- **실시간 백엔드**: Firebase Realtime Database (Spark 무료 플랜, `asia-southeast1`)
- **프론트엔드**: 순수 HTML/CSS/JS + Firebase Web SDK(ESM, CDN)

## 화면

| 탭 | 쓰임 |
| --- | --- |
| 🗺️ 쇼룸 맵 | 클레이 자동차 전시장 위에서 각자의 캐릭터로 자리 잡기 |
| 💬 회의실 | `@이름` 멘션 채팅 |
| 📋 작업실 | 할 일 보드 (`대기 → 진행 중 → 완료`) |

- 모바일에서는 탭으로 한 화면씩, 1060px 이상에서는 세 화면이 한 페이지에 모두 보입니다
  (탭을 누르면 해당 구역으로 이동).
- 상단에 `실시간 연결됨`, `N개 방 가동`, `ON N명` 배지와 `✨ 움직임 ON/OFF` 토글이 있습니다.
  움직임을 끄면 캐릭터의 바운스 애니메이션이 멈춥니다(설정은 브라우저에 저장).

## 쇼룸 맵

- 배경은 3D 클레이로 만든 아이소메트릭 **자동차 전시장** 이미지(`assets/showroom-map.png`)입니다.
  중앙 원형 턴테이블에 실물 크기 전시 차량 한 대가 서 있고, 왼쪽에 카마스터 상담 테이블,
  오른쪽에 소파·커피 테이블·브로슈어 스탠드가 있는 고객 라운지, 뒤쪽에 통유리창과 차량 스펙 디지털 월이 있습니다.
- 구역: 🚘 **메인 쇼룸**(전시 차량 옆) · 🤝 **상담 테이블**(카마스터 상담) · ☕ **고객 라운지**(소파).
- 입장한 피클의 캐릭터가 자기 구역에 서고, 이름·상태 배지가 발밑에 붙습니다.
  상태 메시지가 있으면 말풍선으로 뜨고(한 명뿐인 구역은 항상, 여럿이면 마우스를 올렸을 때), 캐릭터는 부드럽게 떠 있습니다.
- 캐릭터를 누르면 이름·상태·메시지가 토스트로 보입니다.
- `assets/showroom-map.png` 를 불러오지 못하면 자동으로 2D 구역 카드로 대체됩니다.

## 🎨 공간 꾸미기 (함께, 실시간)

맵 헤더의 `🎨 공간 꾸미기` 를 열면 입장한 피클 **누구나** 쇼룸을 꾸밀 수 있고,
같은 쇼룸에 접속한 모든 피클의 화면이 곧바로 같이 바뀝니다.

| 항목 | 값 |
| --- | --- |
| 차 색상 | 펄 화이트 `#f4f6fb`(기본) · 미드나잇 블랙 `#1a202c` · 딥 블루 `#2563eb` · 카민 레드 `#b91c1c` · 메탈릭 실버 `#94a3b8` · 포레스트 그린 `#0f766e` · 딥 그린 `#17493c` |
| 조명 톤 | `gold`(기본) · `warm` · `cool` · `emerald` · `festive` |
| 배너 문구 | 벽면에 걸린 배너 글자 (최대 24자, 길이에 맞춰 자동 축소) |
| 소품 | `tree` 🌲 · `gifts` 🎁 · `carpet` 🟥 · `plants` 🪴 · `welcomeStand` 🪧 · `spotlights` 💡 |
| 표시 | `updatedBy` 마지막으로 꾸민 피클 이름 · `updatedAt` 시각 |

- 값은 `office/decor` 한 노드에 모여 있고, 바꾸는 사람의 이름이 `updatedBy` 에 남습니다.
- 다른 피클이 꾸미면 토스트로 "○○ 님이 공간을 꾸몄어요" 가 뜨고 화면이 부드럽게 따라갑니다.
- `기본값으로` 를 누르면 원래 쇼룸 모습(펄 화이트·골드·소품 없음)으로 돌아갑니다.

클레이 맵에서는 이렇게 반영됩니다.

- **차 색상** — 배경 사진의 전시 차량에만 색을 입힙니다. `assets/car-mask.png`(차체 마스크)로
  차체에만 `mix-blend-mode` 를 걸어 창문·타이어·휠·그림자는 그대로 두고 도장색만 바뀝니다.
  마스크는 전시장 이미지의 차량을 직접 오려 만든 알파 PNG 이며, CSS `.decor-car` 의 사각형(35.09% / 35.84% / 26.63% / 27.25%)에 맞춰 얹습니다.
- **조명 톤** — 배경 사진의 빛을 `filter` 로 바꿉니다(웜 필터·탈색 등). 캐릭터·배너·UI 는 그대로입니다.
- **배너 문구** — 창 위에 매다는 천 배너(`.decor-banner`)에 들어가고, 24자까지 한 줄에 맞게 줄어듭니다.
- **소품** — 맵 위 정해진 자리에 DOM/SVG 로 그려 넣어 화면 폭에 맞춰 같이 커지고 작아집니다.
  켜고 끌 때 살짝 튀어오르는 전환을 넣었고, `✨ 움직임 OFF` 면 전환 없이 바로 바뀝니다.

## 니케 SD 캐릭터

입장·프로필 모달에서 다섯 명 중 하나를 내 캐릭터로 고릅니다. 고른 캐릭터 id 는
`presence.character` 로 저장되어 다른 피클 화면에도 같은 모습으로 보입니다.

| id | 이름 | 이미지 |
| --- | --- | --- |
| `scarlet` | 홍련:흑영 | `assets/char-scarlet.png` |
| `crown` | 크라운 | `assets/char-crown.png` |
| `cinderella` | 신데렐라 | `assets/char-cinderella.png` |
| `redhood` | 레드후드 | `assets/char-redhood.png` |
| `dorothy` | 도로시 | `assets/char-dorothy.png` |

캐릭터를 아직 고르지 않은 예전 데이터는 비어 있는 자리에 이름·id 해시로 다섯 명 중 하나가
자동으로 배정되어 보입니다(본인이 프로필 모달에서 언제든 바꿀 수 있습니다).

## 데이터 구조

```json
office
├─ presence/{pid}   { name, consonant, color, character, zone, status, message, ts }
├─ messages/{mid}   { name, pid, consonant, color, character, text, createdAt }
├─ tasks/{tid}      { title, assignee, assigneeConsonant, assigneeColor, assigneeCharacter, status, createdAt }
└─ decor            { carColor, lightTone, bannerText, props{tree,gifts,carpet,plants,welcomeStand,spotlights}, updatedBy, updatedAt }
```

- 접속 중일 때만 presence 가 유지됩니다(`onDisconnect().remove()`).
- `character` 는 위 다섯 id 중 하나이며, 없으면 id·이름 해시로 다섯 중 하나를 화면에서만 배정합니다.
- `decor` 는 꾸미기 값입니다. 없거나 비어 있으면 기본 쇼룸으로 표시합니다.
- 캐릭터 상태: 대기 중 · 작업 중 · 감시 중 · 회의 중 · 자리 비움

## 이미지 다시 만들기

이미지는 `images` 명령으로 생성한 뒤 `tools/prep-images.py` 로 다듬습니다.

```bash
python3 tools/prep-images.py     # assets/_raw/*.png → assets/*.png (배경 투명화·리사이즈)
```

- `assets/_raw/` 는 생성 원본이라 저장소에 올리지 않습니다(`.gitignore`).
- 배경 이미지는 256색으로 양자화해 용량을 줄였습니다(현재 1536×1024 · 약 700KB).
- `assets/car-mask.png` 는 배경 사진에서 전시 차량 차체만 오려낸 마스크입니다(꾸미기의 차 색상용).

## 이전 3D 스테이지

Three.js 로 만든 3D 쇼룸(`legacy/showroom3d.js`)은 클레이 맵으로 교체되어 더 이상 불러오지 않습니다.
기록용으로만 남겨 두었습니다.

## 로컬에서 열기

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Firebase에 닿지 않으면 자동으로 **로컬 모드**(이 브라우저에만 저장)로 떨어집니다.

## 개인정보

이 저장소와 기본 데이터에는 실제 전화번호·주소·이메일·계정 정보가 없습니다.
쇼룸에 표시되는 이름·캐릭터·상태는 사용자가 직접 고른 정보입니다.
Firebase 클라이언트 설정(apiKey 등)은 공개되어도 되는 웹 앱 식별자이며,
데이터 접근 규칙은 `database.rules.json` 에 정리되어 있습니다.
