import { defineConfig } from 'vite';

// GitHub Pages serves the site under: https://<user>.github.io/<repo>/
// so we must set base to '/<repo>/'
export default defineConfig({
  base: '/claw-doll/',
});
