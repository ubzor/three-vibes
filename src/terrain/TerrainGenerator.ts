import { Scene, Vector3, WebGLRenderer } from 'three'
import { BiomeManager } from '@/biomes/BiomeManager'
import { HeightGenerator } from './HeightGenerator'
import { WaterManager } from './WaterManager'
import { ChunkManager } from './ChunkManager'
import { ShaderManager } from '@/shaders/ShaderManager'

export class TerrainGenerator {
    private scene: Scene
    private biomeManager: BiomeManager
    private heightGenerator: HeightGenerator
    private waterManager: WaterManager
    private chunkManager: ChunkManager
    private shaderManager: ShaderManager
    private renderDistance = 2
    private chunkSize = 100
    private renderer: WebGLRenderer | null = null

    constructor(scene: Scene, renderer?: WebGLRenderer) {
        this.scene = scene
        this.renderer = renderer || null
        this.biomeManager = new BiomeManager()
        this.heightGenerator = new HeightGenerator(this.renderer || undefined)
        this.shaderManager = new ShaderManager()
        this.waterManager = new WaterManager(scene, this.heightGenerator, this.shaderManager)
        this.chunkManager = new ChunkManager(
            scene,
            this.heightGenerator,
            this.waterManager,
            this.biomeManager,
            this.shaderManager
        )
    }
    async initialize(): Promise<void> {
        await this.biomeManager.initialize()

        // Включаем GPU генерацию по умолчанию
        if (this.renderer) {
            try {
                await this.heightGenerator.enableGPUGeneration(this.chunkSize, 128)
            } catch (error) {
                // Fallback to CPU
            }
        }
    }

    generateInitialChunks(): void {
        const centerChunkX = 0
        const centerChunkZ = 0

        // Генерируем чанки в круговом радиусе
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                // Проверяем, находится ли чанк в круговом радиусе
                const distance = Math.sqrt(x * x + z * z)
                if (distance <= this.renderDistance) {
                    this.chunkManager.generateChunk(centerChunkX + x, centerChunkZ + z)
                }
            }
        }
    }

    update(cameraPosition: Vector3): void {
        const chunkX = Math.floor(cameraPosition.x / this.chunkSize)
        const chunkZ = Math.floor(cameraPosition.z / this.chunkSize)

        // Генерируем новые чанки вокруг камеры в круговом радиусе
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                // Проверяем, находится ли чанк в круговом радиусе
                const distance = Math.sqrt(x * x + z * z)
                if (distance <= this.renderDistance) {
                    const targetX = chunkX + x
                    const targetZ = chunkZ + z
                    const chunkKey = `${targetX},${targetZ}`

                    if (!this.chunkManager.getChunks().has(chunkKey)) {
                        this.chunkManager.generateChunk(targetX, targetZ)
                    }
                }
            }
        }

        // Удаляем дальние чанки (используем круговое расстояние)
        const chunksToRemove: string[] = []
        this.chunkManager.getChunks().forEach((chunk, key) => {
            const dx = chunk.position.x - chunkX
            const dz = chunk.position.z - chunkZ
            const distance = Math.sqrt(dx * dx + dz * dz)

            // Добавляем небольшой буфер (+1) чтобы избежать мерцания чанков на границе
            if (distance > this.renderDistance + 1) {
                chunksToRemove.push(key)
            }
        })

        chunksToRemove.forEach(key => {
            this.chunkManager.removeChunk(key)
        })
    }

    updateScale(newScale: number): void {
        this.heightGenerator.updateScale(newScale)
        this.regenerateAllChunks()
    }

    updateRenderDistance(newDistance: number): void {
        this.renderDistance = newDistance
    }

    private regenerateAllChunks(): void {
        const chunkPositions = Array.from(this.chunkManager.getChunks().keys())
        chunkPositions.forEach(key => {
            this.chunkManager.removeChunk(key)
        })
        this.generateInitialChunks()
    }

    dispose(): void {
        this.chunkManager.dispose()
        this.waterManager.dispose()
        this.shaderManager.dispose()
        this.heightGenerator.dispose()
    }

    setWireframe(enabled: boolean): void {
        this.chunkManager.setWireframe(enabled)
        this.waterManager.setWireframe(enabled)
        this.biomeManager.setWireframe(enabled)
    }
    getShaderManager(): ShaderManager {
        return this.shaderManager
    }
}
