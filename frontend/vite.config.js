import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Proxy de desarrollo: el navegador llama a /api en el puerto de Vite.
// Vite reenvía la solicitud a Netlify Dev (8888) y evita CORS local.
// En Vercel no se usa este proxy; VITE_API_BASE debe apuntar a Netlify.
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api/.netlify/functions': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
