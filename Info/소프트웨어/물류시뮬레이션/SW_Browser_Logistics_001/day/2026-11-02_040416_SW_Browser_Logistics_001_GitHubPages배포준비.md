# GitHub Pages 배포 설정

- 버전: v0.0.1
- 최초 생성·수정·작업 일시: 2026-11-02 04:04:16 (KST)
- 기능 ID: SW_Browser_Logistics_001 / 관련 기능 ID: 없음
- 지시자: 이종인 / 작업자: GPT-6 (Codex)

## 개요·용어

사용자의 GitHub 기준 배포 링크 생성 요청에 따라 현재 공개 저장소를 GitHub Pages로 배포하도록 준비한다. Pages는 정적 파일 호스팅이며 Actions는 설치·검사·빌드·배포 자동 실행이다. 이번 요청의 공개 배포와 필요한 push 승인을 적용한다.

## 수정 전후와 실제 동작

변경 전: main=b50d134, 원격과 일치, Pages API 404, 배포 워크플로 없음. 변경 후: vite.config.js에 다음 설정을 추가하고 .github/workflows/pages.yml에서 Node.js 24와 npm ci, npm test, npm run build, upload-pages-artifact, deploy-pages를 연결했다.

```javascript
export default {
  base: '/SmartFactory_v1.0.0/',
};
```

Vite가 HTML의 JS/CSS와 번들의 GLB URL에 저장소 이름을 붙인다. 입력은 기존 소스·에셋·잠금 파일이고 출력은 dist 정적 파일이다. main push 또는 workflow_dispatch가 build를 시작하고 성공한 경우에만 deploy 작업을 실행한다. deploy에만 pages:write와 id-token:write 권한을 부여한다. 기존 기능 코드는 수정하지 않았다. README에 상대 경로로 배포 설명을 추가했으며 개인 PC 절대 경로는 넣지 않았다.

## 확인 결과

- 기존 설치에서 npm test 13개 통과, npm run build 통과. 사용자가 보고했던 잠금 오류·vite 미설치는 현재 빌드에서 재현되지 않았다. Node 프로세스를 종료하거나 node_modules를 삭제하지 않았다.
- 새 base 적용 후 npm run build 재실행 성공. HTML의 JS/CSS 및 GLB 4개 URL이 /SmartFactory_v1.0.0/assets/를 사용하며 해당 파일 존재 확인.
- 최초 경로 검증 정규식이 최소화된 JS 문자열 경계를 잘못 잡아 실패했으나, 실제 파일명별 URL 포함 검증으로 4개 모두 확인. 앱 결함 아님.
- 기존 500kB 초과 번들 경고 유지: JS 819.63kB / gzip 224.44kB. SW_Browser_Logistics_Unresolved_001에 해당.
- 이번 단계에서 배포 활성화·push·실제 URL 응답은 아직 미확인(SW_Browser_Logistics_Unverified_006). 완료 결과를 후속 기록으로 남긴다.

## 기술과 근거

Node.js v24.18.0 / npm 11.16.0 / Vite 8.3.5 / Three.js 0.187.0. Actions의 Node는 24 계열이며 정확 패치는 실행 로그 기준이다. Vite 공식 GitHub Pages 예제의 고정 Action SHA를 사용했다.

- https://vite.dev/guide/static-deploy.html#github-pages
- https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site

관련 코드: C:\Users\Slu93\Desktop\SmartFactory\vite.config.js 및 C:\Users\Slu93\Desktop\SmartFactory\.github\workflows\pages.yml.
