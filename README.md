# 성희의 합동 비서실 · PICKLE MOTORS SHOWROOM

피클들이 함께 쓰는 실시간 합동 비서실입니다. 자동차 전시장(쇼룸) 분위기의 맵에서 각자의 캐릭터가
자리를 잡고, 채팅으로 `@이름` 멘션을 주고받으며, 할 일 보드를 함께 굴립니다.

- **호스팅**: GitHub Pages (정적 파일, 빌드 없음) — `https://dbstjdgml26-cell.github.io/Sejeong/`
- **실시간 백엔드**: Firebase Realtime Database (Spark 무료 플랜, `asia-southeast1`)
- **프론트엔드**: 순수 HTML/CSS/JS + Firebase Web SDK(ESM, CDN)

## 화면

| 구역 | 쓰임 |
| --- | --- |
| 🚘 메인 쇼룸 | 전시 · 메인 업무 |
| 🤝 상담 테이블 | 회의 · 미팅 |
| ☕ 고객 라운지 | 대기 · 모니터링 |

- 캐릭터 상태: 대기 중 · 작업 중 · 감시 중 · 회의 중 · 자리 비움
- 쇼룸 채팅: `@이름` 멘션, 멘션 칩, 메시지를 할 일 보드로 보내기
- 할 일 보드: 담당 피클 지정, `대기 → 진행 중 → 완료` 이동, 삭제
- 초대: 헤더의 `＋ 피클 초대` — 링크와 안내문을 복사해 다른 피클에게 전달

## 데이터 구조

```
office
├─ presence/{pid}   { name, consonant, color, zone, status, message, ts }
├─ messages/{mid}   { name, pid, consonant, color, text, createdAt }
└─ tasks/{tid}      { title, assignee, assigneeColor, assigneeConsonant, status, createdAt }
```

- 접속 중일 때만 presence 가 유지됩니다(`onDisconnect().remove()`).
- 4명 이상이 같은 구역에 있어도 카드가 자동으로 줄바꿈되어 보입니다.

## 개인정보

이 저장소와 기본 데이터에는 실제 전화번호·주소·이메일·계정 정보가 없습니다.
쇼룸에 표시되는 이름·자음·색은 사용자가 직접 입력한 캐릭터 정보입니다.
Firebase 클라이언트 설정(apiKey 등)은 공개되어도 되는 웹 앱 식별자이며,
데이터 접근 규칙은 `database.rules.json` 에 정리되어 있습니다.

## 로컬에서 열기

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Firebase에 닿지 않으면 자동으로 **로컬 모드**(이 브라우저에만 저장)로 떨어집니다.
