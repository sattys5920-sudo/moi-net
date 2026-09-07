# moi.net

1989년식 CRT 모니터 바탕화면 컨셉의 데스크톱 프로토타입. 순수 HTML/CSS/JS라 빌드 과정이 없습니다.

- 프로필 · moi.net(채팅) · 검색 · 내 폴더 · 인터넷 아이콘을 누르면 해당 화면이 열립니다.
- moi.net 채팅은 실제로 동작합니다: 메시지를 입력하고 Enter나 "보내기"를 누르면 내 메시지가 아바타와 함께 대화창에 추가됩니다.
- 창의 ✕ 버튼을 누르면 바탕화면으로 돌아갑니다.

## 로컬에서 보기

빌드가 필요 없으니 `index.html`을 브라우저로 바로 열어도 되고, 정적 서버로 띄워도 됩니다.

```bash
npx serve .
# 또는
python3 -m http.server 8080
```

## Firebase Hosting으로 배포하기

1. **Firebase 프로젝트 만들기** — https://console.firebase.google.com/ 에서 "프로젝트 추가"
2. **Firebase CLI 설치 & 로그인**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
3. **이 저장소를 로컬에 클론한 뒤, 프로젝트 연결**
   ```bash
   git clone <이 저장소 주소>
   cd moi-net
   firebase use --add   # 1번에서 만든 프로젝트 선택
   ```
4. **첫 배포**
   ```bash
   firebase deploy --only hosting
   ```
   완료되면 `https://<프로젝트ID>.web.app` 링크가 나옵니다.

## GitHub에 푸시할 때마다 자동 배포하기 (선택)

Firebase CLI가 GitHub Actions 워크플로를 자동으로 만들어줍니다 (시크릿 설정까지 알아서 처리):

```bash
firebase init hosting:github
```

실행하면서 나오는 질문에 이 저장소를 선택하면, `main` 브랜치에 푸시할 때마다 자동 배포되도록 `.github/workflows/`에 워크플로 파일이 생성됩니다.
