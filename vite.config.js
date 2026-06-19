import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
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
});
