import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react(), {
  name: 'dialkit-local-fonts', enforce: 'pre',
  transform(code, id) {
    if (id.includes('/dialkit/') && id.endsWith('.css')) {
      return code.replace(/@import url\(['"]https:\/\/fonts\.googleapis\.com[^;]+;/g, '');
    }
  },
}] });
