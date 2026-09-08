# LAST LOG : 마지막 접속

2010년대 인터넷 단체 채팅방을 배경으로 한 텍스트 기반 실종 추리 게임. 1989년식 CRT 모니터 바탕화면 컨셉으로 감싸져 있고, NPC와의 대화·검색·최종 추리는 실시간으로 Claude(Anthropic API)가 응답한다.

- **moi.net** — "새벽 2시" 채팅방. 그룹채팅과 6명(모카·잭·유령·복숭아·레몬·검은고양이)과의 1:1 채팅을 오갈 수 있다. 닉네임만 입력하면 그 NPC와의 대화로 전환된다.
- **검색** — 자유 검색어로 조사. 구체적인 키워드일수록 더 깊은 단서가 나온다.
- **단서 수첩** — 지금까지의 전체 대화를 AI가 자동으로 요약해 보여준다.
- **최종 추리** — 5가지 질문에 서술형으로 답하면 AI가 채점한다.
- 채팅창에서 `오늘은 여기까지`라고 입력하면 다음 날(최대 DAY 5)로 넘어간다. `힌트`, `정리해줘`, `검색 ○○○`도 채팅창에서 바로 입력 가능.

게임의 진짜 결말과 NPC들의 숨긴 비밀은 `functions/index.js`의 시스템 프롬프트에만 있고, 프론트엔드 코드에는 전혀 노출되지 않는다.

## 구조

- `index.html` / `style.css` / `script.js` — CRT 데스크톱 UI + 게임 클라이언트 로직 (정적 파일, Firebase Hosting)
- `functions/index.js` — Cloud Function `gameChat`. 서버에서만 Anthropic API를 호출해 API 키를 안전하게 숨긴다.

## 배포 전 필요한 설정 (딱 한 번, 전부 브라우저에서)

이 게임은 실제 API 호출 비용이 발생합니다 (Firebase Blaze 종량제 + Anthropic API 사용량). 아래 순서대로 설정하면 이후에는 `git push`만으로 자동 배포됩니다.

### 1. Firebase 프로젝트를 Blaze(종량제) 요금제로 업그레이드

Firebase 콘솔 → 프로젝트 → 왼쪽 아래 "업그레이드" → Blaze 선택 → 결제 정보 등록.
(Cloud Functions가 외부 API를 호출하려면 Blaze가 필수입니다.)

### 2. Anthropic API 키 발급

https://console.anthropic.com/ → API Keys → 새 키 생성 → 복사.
**이 키를 채팅으로 다른 사람(AI 포함)에게 절대 붙여넣지 마세요.** 아래 3번에서 구글 클라우드 콘솔에만 직접 입력합니다.

### 3. API 키를 Google Cloud Secret Manager에 등록

1. https://console.cloud.google.com/security/secret-manager 접속 (moi-net 프로젝트 선택)
2. "보안 비밀 만들기" 클릭
3. 이름: `ANTHROPIC_API_KEY` (정확히 이 이름이어야 함)
4. 값: 2번에서 복사한 API 키 붙여넣기 → 만들기

### 4. Cloud Function이 그 비밀에 접근할 수 있도록 권한 부여

처음 배포하면 권한 오류가 날 수 있습니다 — 그 경우 에러 메시지에 어떤 서비스 계정이 필요한지 나옵니다.

1. 방금 만든 `ANTHROPIC_API_KEY` 보안 비밀 클릭 → "권한" 탭
2. "액세스 권한 부여" 클릭
3. 주요 원칙: 보통 `<프로젝트번호>-compute@developer.gserviceaccount.com` (Compute 기본 서비스 계정)
4. 역할: "Secret Manager 보안 비밀 접근자(Secret Manager Secret Accessor)" 선택 → 저장

### 5. 코드 배포

이 저장소는 이미 GitHub Actions로 연결되어 있어서, `main` 브랜치에 push되면 Hosting과 Functions가 자동으로 배포됩니다. 별도 명령어가 필요 없습니다.

> 처음 Functions 배포는 Cloud Build, Artifact Registry 등 관련 API가 자동으로 켜지면서 몇 분 걸릴 수 있고, 서비스 계정 권한 문제로 한 번에 성공하지 않을 수도 있습니다. 실패하면 GitHub Actions 로그의 에러 메시지를 확인해주세요.

## 로컬에서 프론트엔드만 보기

Cloud Function 없이는 채팅 응답이 오지 않지만, 화면 구조는 확인할 수 있습니다.

```bash
python3 -m http.server 8080
```
