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
      entry: "src/hapack.js",
      name: "HaVueCard",
      fileName: "aecc-ha-panel",
    },
    rollupOptions: {
      external: [],
      output: {
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        // 强制内联语言文件
        inlineDynamicImports: true,
        manualChunks: undefined, // 禁用代码分割，确保所有内容打包到一个文件
      }
    },
    assetsInlineLimit: 100000000, // 增大内联资源限制，确保所有资源都被内联
    cssCodeSplit: false, // 禁用CSS代码分割
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // 保留控制台日志用于调试
      },
    },
    sourcemap: false,
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
