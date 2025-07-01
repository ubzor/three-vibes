import { Perlin } from 'ts-noise'
import { GPUHeightGenerator, HeightmapConfig } from './GPUHeightGenerator'
import * as THREE from 'three'

export class HeightGenerator {
    private perlin: Perlin
    private heightScale = 30
    private scale = 0.015
    private gpuGenerator: GPUHeightGenerator | null = null
    private useGPU = false
    private renderer: THREE.WebGLRenderer | null = null

    constructor(renderer?: THREE.WebGLRenderer) {
        this.perlin = new Perlin(Math.random())
        this.renderer = renderer || null
    }

    async enableGPUGeneration(chunkSize: number = 100, resolution: number = 128): Promise<void> {
        if (!this.renderer) {
            return
        }

        const config: HeightmapConfig = {
            chunkSize,
            resolution,
            heightScale: this.heightScale,
            noiseScale: this.scale,
        }

        this.gpuGenerator = new GPUHeightGenerator(this.renderer, config)

        try {
            await this.gpuGenerator.initialize()
            this.useGPU = true
        } catch (error) {
            this.gpuGenerator = null
            this.useGPU = false
        }
    }

    // Генерация массива высот для чанка (автоматически использует GPU если доступен)
    async generateHeightmapChunk(
        chunkX: number,
        chunkZ: number,
        chunkSize: number,
        resolution: number
    ): Promise<Float32Array> {
        if (this.useGPU && this.gpuGenerator) {
            try {
                return await this.gpuGenerator.generateHeightmapGPU(chunkX, chunkZ)
            } catch (error) {
                // Fallback to CPU
            }
        }

        // CPU fallback
        return this.generateHeightmapCPU(chunkX, chunkZ, chunkSize, resolution)
    }

    // CPU версия генерации массива высот
    private generateHeightmapCPU(chunkX: number, chunkZ: number, chunkSize: number, resolution: number): Float32Array {
        const heights = new Float32Array(resolution * resolution)

        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const worldX = chunkX * chunkSize + (x / resolution) * chunkSize
                const worldZ = chunkZ * chunkSize + (y / resolution) * chunkSize

                const height = this.generateHeight(worldX, worldZ)
                heights[y * resolution + x] = height
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

    updateScale(newScale: number): void {
        this.scale = newScale
        if (this.gpuGenerator) {
            this.gpuGenerator.updateConfig({ noiseScale: newScale })
        }
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

    dispose(): void {
        if (this.gpuGenerator) {
            this.gpuGenerator.dispose()
        }
    }
}
