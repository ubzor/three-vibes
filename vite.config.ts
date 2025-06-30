import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
    plugins: [svelte()],
    resolve: {
        alias: {
            '@': '/src',
        },
        extensions: ['.ts', '.js', '.tsx', '.jsx', '.svelte'],
    },
    build: {
        target: 'es2022',
        rollupOptions: {
            external: [],
        },
    },
    esbuild: {
        target: 'es2022',
    },
    worker: {
        format: 'es',
        plugins: () => [],
    },
    optimizeDeps: {
        exclude: ['@/workers/ChunkWorker.ts'],
    },
})
