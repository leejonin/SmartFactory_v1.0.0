import { fileURLToPath } from 'node:url';

// 저장소 이름이 바뀌어도 현재 배포 폴더 기준으로 JS·CSS·GLB를 불러온다.
// 공장 전체(index.html)와 공정 컨베이어 상세(conveyor.html) 두 페이지를 함께 빌드한다.
export default {
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        conveyor: fileURLToPath(new URL('./conveyor.html', import.meta.url)),
      },
    },
  },
};
