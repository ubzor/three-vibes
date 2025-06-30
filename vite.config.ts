import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ mode }) => {
    const plugins = [svelte()]

    // Добавляем анализатор бандла только при сборке с анализом
    if (mode === 'analyze') {
        const template = process.env.ANALYZE_TEMPLATE || 'treemap'
        plugins.push(
            visualizer({
                filename: 'dist/stats.html',
                open: true,
                gzipSize: true,
                brotliSize: true,
                template: template as 'treemap' | 'sunburst' | 'network',
                title: `Bundle Analysis - ${template.charAt(0).toUpperCase() + template.slice(1)}`,
            }) as any
        )
    }

    return {
        plugins,
        resolve: {
            alias: {
                '@': '/src',
            },
            extensions: ['.ts', '.js', '.tsx', '.jsx', '.svelte'],
            // Принудительно используем ES модули Three.js
            mainFields: ['module', 'main'],
        },
        build: {
            target: 'es2022',
            minify: 'terser',
            rollupOptions: {
                external: [],
                output: {
                    manualChunks: id => {
                        // Three.js core module - отдельный чанк для three.core.js
                        if (id.includes('three/build/three.core.js')) {
                            return 'three-module'
                        }
                        // Three.js core - основная библиотека
                        if (id.includes('three/build/three.module.js') || id.includes('three/src/')) {
                            return 'three-core'
                        }
                        // Three.js дополнения и примеры
                        if (id.includes('three/examples/jsm/')) {
                            return 'three-addons'
                        }
                        // TS Noise - генерация шума
                        if (id.includes('ts-noise')) {
                            return 'noise'
                        }
                        // Svelte framework исходники
                        if (id.includes('svelte/src/')) {
                            return 'svelte-framework'
                        }
                        // Наши .svelte компоненты
                        if (id.includes('.svelte') || (id.includes('svelte') && !id.includes('svelte/src/'))) {
                            return 'svelte-components'
                        }
                        // Не создаем vendor чанк - пусть остальное попадает в основной чанк
                    },
                },
                treeshake: {
                    preset: 'recommended',
                    moduleSideEffects: id => {
                        // Исключаем side effects для Three.js модулей чтобы улучшить tree shaking
                        return !id.includes('three')
                    },
                },
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
            include: ['three'], // Принудительно оптимизируем Three.js
        },
    }
})
