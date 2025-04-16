import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import replace from '@rollup/plugin-replace';
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        isProduction: true,
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith("ha-"), // 允许 HA 原生标签
        },
      },
      // 启用 Web Component 编译
      customElement: true,
    }),
    replace({
      // 替换所有 process.env.NODE_ENV 为 'production'（或动态值）
      'process.env.NODE_ENV': JSON.stringify('production'),
      // 替换全局 process 对象（针对旧代码）
      // 'process': JSON.stringify({ env: { NODE_ENV: 'production' } }),
      preventAssignment: true, // 防止变量被重新赋值
    }),
  ],
  build: {
    target: 'esnext',
    polyfillDynamicImport: false,
    lib: {
      entry: "src/my-ha-vue-card.js",
      name: "HaVueCard",
      fileName: "my-ha-vue-card",
    },
  },
  server: {
    proxy: {
      '/api': {
        // target: 'http://192.168.3.7',
        target: 'https://monitor.ai-ec.cloud:8443',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});
