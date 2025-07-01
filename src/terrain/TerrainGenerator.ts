import { Scene, Vector3 } from 'three'
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

    constructor(scene: Scene) {
        this.scene = scene
        this.biomeManager = new BiomeManager()
        this.heightGenerator = new HeightGenerator()
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
    }

    generateInitialChunks(): void {
        const centerChunkX = 0
        const centerChunkZ = 0

        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                this.chunkManager.generateChunk(centerChunkX + x, centerChunkZ + z)
            }
        }
    }

    update(cameraPosition: Vector3): void {
        const chunkX = Math.floor(cameraPosition.x / this.chunkSize)
        const chunkZ = Math.floor(cameraPosition.z / this.chunkSize)

        // Generate new chunks around camera
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                const targetX = chunkX + x
                const targetZ = chunkZ + z
                const chunkKey = `${targetX},${targetZ}`

                if (!this.chunkManager.getChunks().has(chunkKey)) {
                    this.chunkManager.generateChunk(targetX, targetZ)
                }
            }
        }

        // Remove distant chunks
        const chunksToRemove: string[] = []
        this.chunkManager.getChunks().forEach((chunk, key) => {
            const distance = Math.max(Math.abs(chunk.position.x - chunkX), Math.abs(chunk.position.z - chunkZ))
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
