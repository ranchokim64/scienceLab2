import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — GitHub Pages 등 어떤 하위 경로에 올려도 동작하도록 상대 경로로 빌드
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: ['chrome100', 'safari15'] },
});
