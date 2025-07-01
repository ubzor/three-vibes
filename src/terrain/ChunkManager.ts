import {
    Scene,
    Mesh,
    MeshLambertMaterial,
    Vector3,
    BufferAttribute,
    DoubleSide,
    BufferGeometry,
    ShaderMaterial,
    MeshBasicMaterial,
} from 'three'
import { HeightGenerator } from './HeightGenerator'
import { WaterManager } from './WaterManager'
import { BiomeType, BiomeTypeValue, BiomeManager } from '@/biomes/BiomeManager'
import { ShaderManager } from '@/shaders/ShaderManager'

interface TerrainChunk {
    mesh: Mesh
    position: { x: number; z: number }
    geometry: BufferGeometry
    material: ShaderMaterial
    wireframeMaterial: MeshBasicMaterial
}

export class ChunkManager {
    private scene: Scene
    private chunks: Map<string, TerrainChunk> = new Map()
    private heightGenerator: HeightGenerator
    private waterManager: WaterManager
    private biomeManager: BiomeManager
    private shaderManager: ShaderManager
    private chunkSize = 100
    private chunkResolution = 64
    private wireframeEnabled = false

    constructor(
        scene: Scene,
        heightGenerator: HeightGenerator,
        waterManager: WaterManager,
        biomeManager: BiomeManager,
        shaderManager: ShaderManager
    ) {
        this.scene = scene
        this.heightGenerator = heightGenerator
        this.waterManager = waterManager
        this.biomeManager = biomeManager
        this.shaderManager = shaderManager
    }

    generateChunk(chunkX: number, chunkZ: number): void {
        const chunkKey = `${chunkX},${chunkZ}`

        if (this.chunks.has(chunkKey)) {
            return
        }

        // Создаём vertices и colors массивы с нуля
        const vertices: number[] = []
        const indices: number[] = []
        const colors: number[] = []

        // Создаём vertices сетку
        for (let z = 0; z <= this.chunkResolution; z++) {
            for (let x = 0; x <= this.chunkResolution; x++) {
                // Локальные координаты в chunk (-50 до +50 для chunkSize=100)
                const localX = (x / this.chunkResolution - 0.5) * this.chunkSize
                const localZ = (z / this.chunkResolution - 0.5) * this.chunkSize

                // Мировые координаты
                const worldX = localX + chunkX * this.chunkSize
                const worldZ = localZ + chunkZ * this.chunkSize

                // Генерируем высоту используя шум
                const height = this.heightGenerator.generateHeight(worldX, worldZ)

                // Создаём vertices в правильной ориентации (Y вверх)
                vertices.push(localX, height, localZ)

                // Определяем биом и цвет
                const biome = this.determineBiome(worldX, worldZ, height)
                const color = this.biomeManager.getBiomeColor(biome, height)

                colors.push(color.r, color.g, color.b)
            }
        }

        // Создаём indices для треугольников
        for (let z = 0; z < this.chunkResolution; z++) {
            for (let x = 0; x < this.chunkResolution; x++) {
                const a = z * (this.chunkResolution + 1) + x
                const b = z * (this.chunkResolution + 1) + x + 1
                const c = (z + 1) * (this.chunkResolution + 1) + x
                const d = (z + 1) * (this.chunkResolution + 1) + x + 1

                // Два треугольника на quad (правильный порядок для фронтальных нормалей)
                indices.push(a, c, b)
                indices.push(b, c, d)
            }
        }

        // Создаём geometry с полными данными
        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
        geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
        geometry.setIndex(indices)
        geometry.computeVertexNormals()

        // Используем шейдерный материал вместо MeshLambertMaterial
        const material = this.shaderManager.createNewTerrainMaterial()

        // Применяем wireframe если он включен
        material.wireframe = this.wireframeEnabled

        const mesh = new Mesh(geometry, material)
        // Не поворачиваем mesh - vertices уже в правильной ориентации
        mesh.position.set(chunkX * this.chunkSize, 0, chunkZ * this.chunkSize)
        mesh.receiveShadow = true // Включаем тени
        mesh.castShadow = false // Terrain не отбрасывает тени (слишком сложно)

        this.scene.add(mesh)

        // Создаем wireframe материал для террейна (черный)
        const wireframeMaterial = new MeshBasicMaterial({
            color: 0x000000,
            wireframe: true,
        })

        // Если wireframe уже включен, используем wireframe материал
        if (this.wireframeEnabled) {
            ;(mesh as any).material = wireframeMaterial
        }

        const chunk: TerrainChunk = {
            mesh,
            position: { x: chunkX, z: chunkZ },
            geometry,
            material,
            wireframeMaterial,
        }

        this.chunks.set(chunkKey, chunk)

        // Создаём поверхность воды для этого chunk (оба подхода)
        this.waterManager.createWaterSurface(chunkX, chunkZ, this.chunkSize)

        // Пробуем альтернативный подход для лучшего покрытия
        this.waterManager.createWaterSurfaceAdvanced(chunkX, chunkZ, this.chunkSize)

        // Проверяем соседние чанки и пересоздаем для них воду если нужно
        this.recheckAdjacentWater(chunkX, chunkZ)
    }

    private recheckAdjacentWater(chunkX: number, chunkZ: number): void {
        // Проверяем 8 соседних чанков
        const adjacentChunks = [
            [chunkX - 1, chunkZ - 1],
            [chunkX, chunkZ - 1],
            [chunkX + 1, chunkZ - 1],
            [chunkX - 1, chunkZ],
            /*[chunkX, chunkZ],*/ [chunkX + 1, chunkZ],
            [chunkX - 1, chunkZ + 1],
            [chunkX, chunkZ + 1],
            [chunkX + 1, chunkZ + 1],
        ]

        for (const [adjX, adjZ] of adjacentChunks) {
            const adjKey = `${adjX},${adjZ}`
            if (this.chunks.has(adjKey)) {
                // Пересоздаем воду для соседнего чанка
                this.waterManager.createWaterSurface(adjX, adjZ, this.chunkSize)
                this.waterManager.createWaterSurfaceAdvanced(adjX, adjZ, this.chunkSize)
            }
        }
    }

    private determineBiome(x: number, z: number, height: number): BiomeTypeValue {
        // Используем heightGenerator для получения дополнительных шумов
        const moisture = this.heightGenerator.getNoise2D(x * 0.01, z * 0.01)
        const temperature = this.heightGenerator.getNoise2D((x + 1000) * 0.008, (z + 1000) * 0.008)

        // Water - только в самых глубоких впадинах (уменьшаем на 50%)
        if (height < -4) return BiomeType.WATER

        // Beach/Sand - уменьшаем на 35% делая условия более строгими
        if (height < 1 || (moisture > 0.3 && temperature > 0.1 && height < 3)) return BiomeType.SAND

        // Mountain/Rocks - увеличиваем количество гор, снижаем порог
        if (height > 15) return BiomeType.ROCKS

        // Forest - делаем леса более частыми на средних высотах
        if (moisture > -0.1 && temperature > -0.5 && height > 4 && height < 18) return BiomeType.FOREST

        // Fields - основные равнины занимают большую часть ландшафта
        return BiomeType.FIELDS
    }

    removeChunk(chunkKey: string): void {
        const chunk = this.chunks.get(chunkKey)
        if (!chunk) return

        // Remove water surface
        this.waterManager.removeWaterSurface(chunkKey)

        // Remove chunk mesh
        this.scene.remove(chunk.mesh)
        chunk.geometry.dispose()

        // Удаляем оба материала
        this.shaderManager.removeMaterial(chunk.material)
        chunk.material.dispose()
        chunk.wireframeMaterial.dispose()

        this.chunks.delete(chunkKey)
    }

    getChunks(): Map<string, TerrainChunk> {
        return this.chunks
    }

    setWireframe(enabled: boolean): void {
        this.wireframeEnabled = enabled
        this.chunks.forEach(chunk => {
            if (enabled) {
                // Переключаем на wireframe материал
                ;(chunk.mesh as any).material = chunk.wireframeMaterial
            } else {
                // Возвращаем обычный материал
                ;(chunk.mesh as any).material = chunk.material
            }
        })
        this.biomeManager.setWireframe(enabled)
    }

    dispose(): void {
        this.chunks.forEach((chunk, key) => {
            this.removeChunk(key)
        })
        this.chunks.clear()
    }
}
