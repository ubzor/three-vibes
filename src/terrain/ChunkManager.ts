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
import { globalProfiler } from '@/utils/Profiler'
import { ChunkWorkerPool } from './ChunkWorkerPool'
import { ChunkStateManager, ChunkState } from './ChunkStateManager'
import { ChunkGenerationRequest, ChunkGenerationResult } from './ChunkWorker'

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

    // Система воркеров
    private workerPool: ChunkWorkerPool
    private stateManager: ChunkStateManager
    private isWorkerSystemEnabled = true // Включаем обратно с исправленной реализацией
    private maxConcurrentGenerations = 2 // Уменьшаем для лучшей производительности
    private processingInterval: number | null = null
    private lastCameraUpdate = 0 // Для throttling обновлений камеры

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

        // Инициализируем систему воркеров
        this.stateManager = new ChunkStateManager()
        this.workerPool = new ChunkWorkerPool({
            maxWorkers: navigator.hardwareConcurrency || 4,
            workerScript: './ChunkWorker.ts',
        })

        // Инициализируем асинхронно, но не блокируем конструктор
        this.initializeWorkerSystem().catch(error => {
            console.warn('Failed to initialize worker system in constructor:', error)
            this.isWorkerSystemEnabled = false
        })
    }

    async initializeWorkerSystem(): Promise<void> {
        if (!this.isWorkerSystemEnabled) {
            console.log('🖥️ Worker system disabled, using CPU generation')
            return
        }

        try {
            console.log('🔄 Initializing chunk worker system...')
            await this.workerPool.initialize()

            // Запускаем обработку чанков каждые 150мс для лучшей производительности
            this.processingInterval = window.setInterval(() => {
                this.processChunkQueue()
            }, 150)

            console.log('✅ Chunk worker system initialized successfully')
            console.log('📊 Worker system stats on startup:', this.getWorkerStats())
        } catch (error) {
            console.warn('⚠️ Failed to initialize worker system, falling back to CPU generation:', error)
            this.isWorkerSystemEnabled = false

            // Очищаем состояние менеджера если воркеры не работают
            this.stateManager = new ChunkStateManager()
        }
    }

    // Групповая генерация чанков с профайлингом
    generateChunks(chunks: Array<{ x: number; z: number }>): void {
        if (chunks.length === 0) return

        if (this.isWorkerSystemEnabled) {
            // Используем новую систему воркеров
            for (const chunk of chunks) {
                this.stateManager.addChunk(chunk.x, chunk.z, ChunkState.PENDING)
            }
            return
        }

        // Legacy генерация для обратной совместимости
        const geometryStartTime = performance.now()
        let geometryChunks = 0

        globalProfiler.startStep('📐 Geometry Generation')
        const generatedGeometry: Map<string, { x: number; z: number; data: any }> = new Map()

        for (const chunk of chunks) {
            if (!this.chunks.has(`${chunk.x},${chunk.z}`)) {
                const geometryData = this.generateChunkGeometry(chunk.x, chunk.z)
                generatedGeometry.set(`${chunk.x},${chunk.z}`, { x: chunk.x, z: chunk.z, data: geometryData })
                geometryChunks++
            }
        }
        globalProfiler.endStep()

        const materialStartTime = performance.now()
        let materialChunks = 0

        globalProfiler.startStep('🎨 Materials & Meshes')
        for (const [key, chunkInfo] of generatedGeometry) {
            this.createChunkMesh(chunkInfo.x, chunkInfo.z, chunkInfo.data)
            materialChunks++
        }
        globalProfiler.endStep()

        const waterStartTime = performance.now()
        let waterChunks = 0

        globalProfiler.startStep('💧 Water Generation')
        for (const chunk of chunks) {
            const chunkKey = `${chunk.x},${chunk.z}`
            if (this.chunks.has(chunkKey)) {
                this.waterManager.createWaterSurface(chunk.x, chunk.z, this.chunkSize)
                waterChunks++
            }
        }
        globalProfiler.endStep()

        console.log(
            `🔧 Chunk batch processed: ${geometryChunks} geometry, ${materialChunks} materials, ${waterChunks} water`
        )
    }

    private generateChunkGeometry(
        chunkX: number,
        chunkZ: number
    ): { vertices: Float32Array; indices: Uint32Array; colors: Float32Array } {
        const chunkKey = `${chunkX},${chunkZ}`

        if (this.chunks.has(chunkKey)) {
            return { vertices: new Float32Array(), indices: new Uint32Array(), colors: new Float32Array() }
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

        return {
            vertices: new Float32Array(vertices),
            indices: new Uint32Array(indices),
            colors: new Float32Array(colors),
        }
    }

    private createChunkMesh(
        chunkX: number,
        chunkZ: number,
        geometryData?: { vertices: Float32Array; indices: Uint32Array; colors: Float32Array }
    ): void {
        const chunkKey = `${chunkX},${chunkZ}`

        if (this.chunks.has(chunkKey)) return

        // Используем переданные данные или генерируем новые
        const data = geometryData || this.generateChunkGeometry(chunkX, chunkZ)

        // Создаём geometry с полными данными
        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new BufferAttribute(data.vertices, 3))
        geometry.setAttribute('color', new BufferAttribute(data.colors, 3))
        geometry.setIndex(Array.from(data.indices))
        geometry.computeVertexNormals()

        // Используем шейдерный материал вместо MeshLambertMaterial
        const material = this.shaderManager.createNewTerrainMaterial()

        // Применяем wireframe если он включен
        material.wireframe = this.wireframeEnabled

        const mesh = new Mesh(geometry, material)
        mesh.position.set(chunkX * this.chunkSize, 0, chunkZ * this.chunkSize)
        mesh.receiveShadow = true
        mesh.castShadow = false

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
    }

    private determineBiome(x: number, z: number, height: number): BiomeTypeValue {
        // Используем heightGenerator для получения дополнительных шумов
        const moisture = this.heightGenerator.getNoise2D(x * 0.01, z * 0.01)
        const temperature = this.heightGenerator.getNoise2D((x + 1000) * 0.008, (z + 1000) * 0.008)

        // Water - для точек ниже уровня воды (0)
        if (height < 0) return BiomeType.WATER

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

    // Методы для настройки радиуса рендеринга
    setRenderRadius(radius: number): void {
        if (this.stateManager) {
            this.stateManager.setRenderRadius(radius)
            console.log(`🔧 Render radius updated to ${radius} chunks`)
        }
    }

    getRenderRadius(): number {
        return this.stateManager ? this.stateManager.getRenderRadius() : 3
    }

    dispose(): void {
        // Останавливаем систему воркеров
        if (this.processingInterval) {
            clearInterval(this.processingInterval)
            this.processingInterval = null
        }

        if (this.workerPool) {
            this.workerPool.dispose()
        }

        this.chunks.forEach((chunk, key) => {
            this.removeChunk(key)
        })
        this.chunks.clear()
    }

    // Новые методы для работы с воркерами

    updateCameraPosition(x: number, z: number): void {
        const now = Date.now()
        if (now - this.lastCameraUpdate < 100) return // Throttle до 10 раз в секунду

        this.lastCameraUpdate = now
        const chunkX = Math.floor(x / this.chunkSize)
        const chunkZ = Math.floor(z / this.chunkSize)

        // Обновляем центр в менеджере состояний (автоматически очищает чанки)
        this.stateManager.updateCenter(chunkX, chunkZ)

        // Отменяем задачи в пуле воркеров, которые вне радиуса видимости
        if (this.isWorkerSystemEnabled && this.workerPool) {
            const renderRadius = this.stateManager.getRenderRadius()
            const cancelledTasks = this.workerPool.cancelOutOfRangeTasks(chunkX, chunkZ, renderRadius + 1)

            // Логируем только если отменили много задач
            if (cancelledTasks > 5) {
                console.log(`🚫 Cancelled ${cancelledTasks} out-of-range worker tasks`)
            }
        }
    }

    private async processChunkQueue(): Promise<void> {
        if (!this.isWorkerSystemEnabled) return

        // Обрабатываем готовые чанки
        this.processReadyChunks()

        // Запускаем новые генерации
        await this.startNewGenerations()
    }

    private processReadyChunks(): void {
        const readyChunks = this.stateManager.getReadyChunks()
        const maxMeshesPerFrame = 1 // Создаем только 1 меш за кадр для плавности
        let processedCount = 0

        for (const chunkInfo of readyChunks) {
            if (processedCount >= maxMeshesPerFrame) break
            if (!chunkInfo.geometryData) continue

            try {
                this.createChunkMeshFromWorkerData(chunkInfo.geometryData)
                this.stateManager.setChunkState(chunkInfo.x, chunkInfo.z, ChunkState.RENDERED)

                // Создаём воду для чанка
                this.waterManager.createWaterSurface(chunkInfo.x, chunkInfo.z, this.chunkSize)

                processedCount++
            } catch (error) {
                console.error(`❌ Failed to create mesh for chunk ${chunkInfo.key}:`, error)
                this.stateManager.setChunkState(chunkInfo.x, chunkInfo.z, ChunkState.PENDING)
            }
        }
    }

    private async startNewGenerations(): Promise<void> {
        const pendingChunks = this.stateManager.getPendingChunks()
        const generatingCount = this.stateManager.getGeneratingChunks().length

        const availableSlots = this.maxConcurrentGenerations - generatingCount
        const chunksToGenerate = pendingChunks.slice(0, availableSlots)

        for (const chunkInfo of chunksToGenerate) {
            try {
                const generationId = `${chunkInfo.key}_${Date.now()}`

                const request: ChunkGenerationRequest = {
                    id: generationId,
                    chunkX: chunkInfo.x,
                    chunkZ: chunkInfo.z,
                    chunkSize: this.chunkSize,
                    chunkResolution: this.chunkResolution,
                    heightGeneratorConfig: {
                        seed: this.heightGenerator.getSeed(),
                        scale: this.heightGenerator.getScale(),
                        heightScale: this.heightGenerator.getHeightScale(),
                        octaves: 6,
                        persistence: 0.5,
                        lacunarity: 2.0,
                    },
                }

                this.stateManager.setChunkState(chunkInfo.x, chunkInfo.z, ChunkState.GENERATING, generationId)

                // Запускаем генерацию в воркере
                const result = await this.workerPool.generateChunk(request)

                // Проверяем что чанк все еще нужен (мог быть удален пока генерировался)
                const currentState = this.stateManager.getChunkState(chunkInfo.x, chunkInfo.z)
                if (currentState === ChunkState.GENERATING) {
                    this.stateManager.setChunkState(chunkInfo.x, chunkInfo.z, ChunkState.READY, result)
                }
            } catch (error) {
                console.error(`❌ Chunk generation failed for ${chunkInfo.key}:`, error)
                this.stateManager.setChunkState(chunkInfo.x, chunkInfo.z, ChunkState.PENDING)
            }
        }
    }

    private createChunkMeshFromWorkerData(result: ChunkGenerationResult): void {
        const chunkKey = `${result.chunkX},${result.chunkZ}`

        if (this.chunks.has(chunkKey)) {
            return // Чанк уже существует
        }

        // Создаём geometry с данными от воркера
        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new BufferAttribute(result.vertices, 3))
        geometry.setAttribute('color', new BufferAttribute(result.colors, 3))
        geometry.setIndex(Array.from(result.indices))

        // Вычисляем нормали асинхронно для лучшей производительности
        requestAnimationFrame(() => {
            geometry.computeVertexNormals()

            // Создаём материал
            const material = this.shaderManager.createNewTerrainMaterial()
            material.wireframe = this.wireframeEnabled

            const mesh = new Mesh(geometry, material)
            mesh.position.set(result.chunkX * this.chunkSize, 0, result.chunkZ * this.chunkSize)
            mesh.receiveShadow = true
            mesh.castShadow = false

            this.scene.add(mesh)

            // Создаем wireframe материал
            const wireframeMaterial = new MeshBasicMaterial({
                color: 0x000000,
                wireframe: true,
            })

            if (this.wireframeEnabled) {
                ;(mesh as any).material = wireframeMaterial
            }

            const chunk: TerrainChunk = {
                mesh,
                position: { x: result.chunkX, z: result.chunkZ },
                geometry,
                material,
                wireframeMaterial,
            }

            this.chunks.set(chunkKey, chunk)
        })
    }

    // Обновленный метод генерации для совместимости
    generateChunk(chunkX: number, chunkZ: number): void {
        if (this.isWorkerSystemEnabled) {
            // Используем новую систему воркеров
            this.stateManager.addChunk(chunkX, chunkZ, ChunkState.PENDING)
        } else {
            // Fallback на старую систему
            this.generateChunkLegacy(chunkX, chunkZ)
        }
    }

    private generateChunkLegacy(chunkX: number, chunkZ: number): void {
        const chunkKey = `${chunkX},${chunkZ}`

        if (this.chunks.has(chunkKey)) {
            return
        }

        // Используем упрощенную генерацию без детального профайлинга
        const geometryData = this.generateChunkGeometry(chunkX, chunkZ)
        this.createChunkMesh(chunkX, chunkZ, geometryData)

        // Создаём поверхность воды для этого chunk
        this.waterManager.createWaterSurface(chunkX, chunkZ, this.chunkSize)
    }

    getWorkerStats(): {
        workerPool: any
        stateManager: any
    } {
        return {
            workerPool: this.workerPool?.getStats() || null,
            stateManager: this.stateManager?.getStats() || null,
        }
    }
}
