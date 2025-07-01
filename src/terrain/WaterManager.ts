import { Scene, Mesh, PlaneGeometry, MeshPhongMaterial, DoubleSide, ShaderMaterial, MeshBasicMaterial } from 'three'
import { HeightGenerator } from './HeightGenerator'
import { ShaderManager } from '@/shaders/ShaderManager'
import { globalProfiler } from '@/utils/Profiler'

interface WaterMeshData {
    mesh: Mesh
    originalMaterial: ShaderMaterial
    wireframeMaterial: MeshBasicMaterial
}

export class WaterManager {
    private scene: Scene
    private heightGenerator: HeightGenerator
    private shaderManager: ShaderManager
    private waterMeshes: Map<string, WaterMeshData> = new Map()
    private waterLevel = 0 // Единый уровень воды на высоте 0
    private wireframeEnabled = false

    constructor(scene: Scene, heightGenerator: HeightGenerator, shaderManager: ShaderManager) {
        this.scene = scene
        this.heightGenerator = heightGenerator
        this.shaderManager = shaderManager
    }

    createWaterSurface(chunkX: number, chunkZ: number, chunkSize: number): void {
        const chunkKey = `${chunkX},${chunkZ}`

        // Избегаем дублирования воды
        if (this.waterMeshes.has(chunkKey)) {
            return
        }

        // Упрощённый и более надёжный алгоритм:
        // Если в чанке есть хотя бы одна точка ниже уровня воды - создаём водную поверхность
        let hasWaterPoints = false

        // Проверяем сетку точек с хорошим разрешением
        const testResolution = 16 // Увеличиваем для большей точности
        for (let testX = 0; testX <= testResolution && !hasWaterPoints; testX++) {
            for (let testZ = 0; testZ <= testResolution && !hasWaterPoints; testZ++) {
                const worldX = (testX / testResolution - 0.5) * chunkSize + chunkX * chunkSize
                const worldZ = (testZ / testResolution - 0.5) * chunkSize + chunkZ * chunkSize
                const height = this.heightGenerator.generateHeight(worldX, worldZ)

                if (height < this.waterLevel) {
                    hasWaterPoints = true
                }
            }
        }

        // Дополнительная проверка краёв чанка для соединения с соседними водоёмами
        if (!hasWaterPoints) {
            hasWaterPoints = this.checkChunkEdgesForWater(chunkX, chunkZ, chunkSize)
            // if (hasWaterPoints) {
            //     console.log(`🌊 Water created via edge check for chunk (${chunkX}, ${chunkZ})`)
            // }
        }

        // Финальная проверка - есть ли соседние чанки с водой
        if (!hasWaterPoints) {
            hasWaterPoints = this.hasAdjacentWaterChunks(chunkX, chunkZ)
            // if (hasWaterPoints) {
            //     console.log(`🔗 Water created via adjacent check for chunk (${chunkX}, ${chunkZ})`)
            // }
        }

        if (hasWaterPoints) {
            this.createWaterMesh(chunkX, chunkZ, chunkSize)
            // Логируем только для отладки проблем с водой
            // console.log(`💧 Water created for chunk (${chunkX}, ${chunkZ})`)
        } else {
            // console.log(`🏔️ No water needed for chunk (${chunkX}, ${chunkZ})`)
        }
    }

    // Проверка краёв чанка для обеспечения непрерывности водоёмов
    private checkChunkEdgesForWater(chunkX: number, chunkZ: number, chunkSize: number): boolean {
        const edgePoints = []
        const edgeResolution = 8

        // Левый край
        for (let i = 0; i <= edgeResolution; i++) {
            const worldX = chunkX * chunkSize - chunkSize * 0.5
            const worldZ = (i / edgeResolution - 0.5) * chunkSize + chunkZ * chunkSize
            edgePoints.push([worldX, worldZ])
        }

        // Правый край
        for (let i = 0; i <= edgeResolution; i++) {
            const worldX = chunkX * chunkSize + chunkSize * 0.5
            const worldZ = (i / edgeResolution - 0.5) * chunkSize + chunkZ * chunkSize
            edgePoints.push([worldX, worldZ])
        }

        // Верхний край
        for (let i = 0; i <= edgeResolution; i++) {
            const worldX = (i / edgeResolution - 0.5) * chunkSize + chunkX * chunkSize
            const worldZ = chunkZ * chunkSize - chunkSize * 0.5
            edgePoints.push([worldX, worldZ])
        }

        // Нижний край
        for (let i = 0; i <= edgeResolution; i++) {
            const worldX = (i / edgeResolution - 0.5) * chunkSize + chunkX * chunkSize
            const worldZ = chunkZ * chunkSize + chunkSize * 0.5
            edgePoints.push([worldX, worldZ])
        }

        // Проверяем каждую точку края
        for (const [x, z] of edgePoints) {
            const height = this.heightGenerator.generateHeight(x, z)
            if (height < this.waterLevel) {
                return true
            }
        }

        return false
    }

    private hasAdjacentWaterChunks(chunkX: number, chunkZ: number): boolean {
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
            if (this.waterMeshes.has(adjKey)) {
                return true
            }
        }
        return false
    }

    private createWaterMesh(chunkX: number, chunkZ: number, chunkSize: number): void {
        // Простая геометрия для воды
        const waterGeometry = new PlaneGeometry(chunkSize, chunkSize, 32, 32)

        // Используем шейдерный материал для воды
        const waterMaterial = this.shaderManager.createNewWaterMaterial()

        // Создаем wireframe материал для воды (синий)
        const wireframeMaterial = new MeshBasicMaterial({
            color: 0x0066ff,
            wireframe: true,
            transparent: true,
            opacity: 0.8,
        })

        const waterMesh = new Mesh(waterGeometry, waterMaterial)
        waterMesh.rotation.x = -Math.PI / 2
        waterMesh.position.set(chunkX * chunkSize, this.waterLevel, chunkZ * chunkSize)
        waterMesh.receiveShadow = true
        waterMesh.castShadow = false

        // Если wireframe включен, используем wireframe материал
        if (this.wireframeEnabled) {
            ;(waterMesh as any).material = wireframeMaterial
        }

        this.scene.add(waterMesh)

        // Сохраняем reference
        const chunkKey = `${chunkX},${chunkZ}`
        const waterData: WaterMeshData = {
            mesh: waterMesh,
            originalMaterial: waterMaterial,
            wireframeMaterial: wireframeMaterial,
        }
        this.waterMeshes.set(chunkKey, waterData)
    }

    removeWaterSurface(chunkKey: string): void {
        const waterData = this.waterMeshes.get(chunkKey)
        if (waterData) {
            this.scene.remove(waterData.mesh)
            if (waterData.mesh.geometry) waterData.mesh.geometry.dispose()

            // Удаляем оба материала
            this.shaderManager.removeMaterial(waterData.originalMaterial)
            waterData.originalMaterial.dispose()
            waterData.wireframeMaterial.dispose()

            this.waterMeshes.delete(chunkKey)
        }
    }

    dispose(): void {
        this.waterMeshes.forEach((waterData, key) => {
            this.removeWaterSurface(key)
        })
        this.waterMeshes.clear()
    }

    setWireframe(enabled: boolean): void {
        this.wireframeEnabled = enabled
        this.waterMeshes.forEach(waterData => {
            if (enabled) {
                // Переключаем на wireframe материал
                ;(waterData.mesh as any).material = waterData.wireframeMaterial
            } else {
                // Возвращаем обычный материал
                ;(waterData.mesh as any).material = waterData.originalMaterial
            }
        })
    }
}
