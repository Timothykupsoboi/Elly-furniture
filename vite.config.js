import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '')
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          about: resolve(__dirname, 'about.html'),
          shop: resolve(__dirname, 'shop.html'),
          cart: resolve(__dirname, 'cart.html'),
          checkout: resolve(__dirname, 'checkout.html'),
          contact: resolve(__dirname, 'contact.html'),
          services: resolve(__dirname, 'services.html'),
          blog: resolve(__dirname, 'blog.html'),
          thankyou: resolve(__dirname, 'thankyou.html'),
          adminLogin: resolve(__dirname, 'admin-login.html'),
          admin: resolve(__dirname, 'admin.html')
        }
      }
    }
  };
});
