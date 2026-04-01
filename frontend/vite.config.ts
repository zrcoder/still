import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.warn', 'console.info'],
        passes: 2,
        unused: true,
        inline: 2,
      },
      mangle: {
        properties: false,
        reserved: ['_audio', '_renderNarrative', '_creationPage', '_renderCollection', '_clearCreations', '_loadCreations'],
      },
      format: {
        comments: false,
        beautify: false,
      },
    },
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
