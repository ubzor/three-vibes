import { Perlin } from 'ts-noise'
import { GPUHeightGenerator, type HeightmapConfig } from './GPUHeightGenerator'
import * as THREE from 'three'

export class HeightGenerator {
    private perlin: Perlin
    private heightScale = 30
    private scale = 0.015
    private gpuGenerator: GPUHeightGenerator | null = null
    private renderer: THREE.WebGLRenderer | null = null

    constructor(renderer?: THREE.WebGLRenderer) {
        this.perlin = new Perlin(Math.random())
        if (renderer) {
            this.renderer = renderer
            this.initializeGPUGenerator()
        }
    }

    private async initializeGPUGenerator(): Promise<void> {
        if (!this.renderer) return

        console.log('🖥️ Initializing GPU height generator...')

        const config: HeightmapConfig = {
            chunkSize: 64,
            resolution: 64,
            heightScale: this.heightScale,
            noiseScale: this.scale,
            seed: Math.random(),
        }

        this.gpuGenerator = new GPUHeightGenerator(this.renderer, config)
        try {
            await this.gpuGenerator.initialize()
            console.log('✅ GPU height generator initialized successfully')
        } catch (error) {
            console.warn('❌ Failed to initialize GPU height generator:', error)
            console.warn('📋 Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                renderer: this.renderer ? 'Available' : 'Not available',
                webgl2: this.renderer?.getContext() instanceof WebGL2RenderingContext ? 'Supported' : 'Not supported',
            })
            this.gpuGenerator = null
        }
    }

    // Метод для генерации heightmap для чанка
    async generateHeightmapChunk(chunkX: number, chunkZ: number, size: number): Promise<Float32Array> {
        if (this.gpuGenerator) {
            try {
                return await this.gpuGenerator.generateHeightmapGPU(chunkX, chunkZ)
            } catch (error) {
                console.warn('GPU generation failed, falling back to CPU:', error)
            }
        }

        // Fallback к CPU генерации
        const heights = new Float32Array(size * size)
        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                const worldX = chunkX * size + x
                const worldZ = chunkZ * size + z
                heights[z * size + x] = this.generateHeight(worldX, worldZ)
            }
        }
        return heights
    }

    generateHeight(x: number, z: number): number {
        // Базовая высота terrain с несколькими октавами
        let baseHeight = 0
        let amplitude = 1
        let frequency = this.scale

        // Генерируем базовую высоту с multiple octaves
        for (let i = 0; i < 6; i++) {
            const noiseValue = this.perlin.get2([x * frequency, z * frequency])
            baseHeight += noiseValue * amplitude
            amplitude *= 0.5
            frequency *= 2
        }

        // Добавляем крупномасштабные features (горы/равнины)
        const mountainNoise = this.perlin.get2([x * 0.001, z * 0.001]) // Укрупняем горы (было 0.002)
        const hillNoise = this.perlin.get2([x * 0.008, z * 0.008])

        // Специальный шум для создания впадин/озер - оставляем крупные, убираем мелкие
        const lakeNoise = this.perlin.get2([x * 0.002, z * 0.002]) // Еще крупнее озера (было 0.003)
        const riverNoise = this.perlin.get2([x * 0.004, z * 0.004]) // Крупнее реки (было 0.006)

        // Создаём более разнообразный ландшафт
        let finalHeight = baseHeight * (this.heightScale * 0.8) // Увеличиваем общую высоту для лучших гор

        // Создаём глубокие впадины для озер/рек - уменьшаем количество воды на 50%
        if (lakeNoise < -0.75 || (riverNoise < -0.8 && lakeNoise < -0.5)) {
            const lakeFactor = lakeNoise < -0.75 ? Math.pow(Math.abs(lakeNoise + 0.75) / 0.25, 1.5) : 0
            const riverFactor =
                riverNoise < -0.8 && lakeNoise < -0.5 ? Math.pow(Math.abs(riverNoise + 0.8) / 0.2, 2) : 0
            const depthFactor = Math.max(lakeFactor, riverFactor)
            finalHeight -= depthFactor * 8 // Сохраняем глубину для крупных водоемов
        }

        // Горы с более низким порогом и укрупненные
        if (mountainNoise > 0.2) {
            // Увеличиваем количество гор (было 0.3, стало 0.2)
            const mountainFactor = Math.pow((mountainNoise - 0.2) / 0.8, 1.2) // Более плавный рост
            finalHeight += mountainFactor * 60 // Увеличиваем высоту гор (было 50)
        }

        // Увеличиваем влияние холмов для более разнообразного ландшафта
        finalHeight += hillNoise * 12

        // Создаём мягкие долины
        const valleyNoise = this.perlin.get2([x * 0.005, z * 0.005])
        if (valleyNoise < -0.3) {
            finalHeight *= 0.8 // Более мягкие долины
        }

        // Поднимаем общий уровень равнин выше нуля
        finalHeight += 5 // Больше подъем для преобладания равнин

        return finalHeight
    }

    updateHeightScale(newHeightScale: number): void {
        this.heightScale = newHeightScale
        if (this.gpuGenerator) {
            this.gpuGenerator.updateConfig({ heightScale: newHeightScale })
        }
    }

    // Публичный метод для доступа к шуму из других классов
    getNoise2D(x: number, z: number): number {
        return this.perlin.get2([x, z])
    }

    // Метод для включения GPU генерации с настройками
    async enableGPUGeneration(chunkSize: number, resolution: number): Promise<void> {
        console.log(`🚀 Enabling GPU generation with chunk size: ${chunkSize}, resolution: ${resolution}`)

        if (!this.renderer) {
            console.error('❌ Renderer is required for GPU generation')
            throw new Error('Renderer is required for GPU generation')
        }

        console.log(`🔧 Enabling GPU generation with chunkSize: ${chunkSize}, resolution: ${resolution}`)

        const config: HeightmapConfig = {
            chunkSize: chunkSize,
            resolution: resolution,
            heightScale: this.heightScale,
            noiseScale: this.scale,
            seed: Math.random(),
        }

        console.log('🔧 Creating GPU height generator with config:', config)
        this.gpuGenerator = new GPUHeightGenerator(this.renderer, config)
        try {
            await this.gpuGenerator.initialize()
            console.log('✅ GPU generation enabled successfully')
        } catch (error) {
            console.error('❌ Failed to enable GPU generation:', error)
            this.gpuGenerator = null
            throw error
        }
    }

    dispose(): void {
        if (this.gpuGenerator) {
            this.gpuGenerator.dispose()
        }
    }
}
