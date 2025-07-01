import { Scene, Mesh, PlaneGeometry, MeshPhongMaterial, DoubleSide, ShaderMaterial, MeshBasicMaterial } from 'three'
import { HeightGenerator } from './HeightGenerator'
import { ShaderManager } from '@/shaders/ShaderManager'

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
    private waterLevel = -2 // Единый уровень воды
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

        let hasWaterAreas = false
        let waterAreaCount = 0

        // Проверяем больше точек для более точного определения водных областей
        const testResolution = 8 // Увеличиваем разрешение тестирования
        for (let testX = 0; testX <= testResolution; testX++) {
            for (let testZ = 0; testZ <= testResolution; testZ++) {
                const worldX = (testX / testResolution - 0.5) * chunkSize + chunkX * chunkSize
                const worldZ = (testZ / testResolution - 0.5) * chunkSize + chunkZ * chunkSize
                const height = this.heightGenerator.generateHeight(worldX, worldZ)

                if (height < this.waterLevel) {
                    waterAreaCount++
                }
            }
        }

        const totalTestPoints = (testResolution + 1) * (testResolution + 1)
        // Снижаем требования еще больше - достаточно 8% точек под водой
        hasWaterAreas = waterAreaCount >= Math.ceil(totalTestPoints * 0.08)

        // Дополнительная проверка - если есть хотя бы одна глубокая точка,
        // проверяем соседние области для создания связанных водоемов
        if (!hasWaterAreas && waterAreaCount >= 1) {
            hasWaterAreas = this.checkAdjacentWaterAreas(chunkX, chunkZ, chunkSize)
        }

        // Проверяем, есть ли уже вода в соседних чанках (более агрессивно)
        if (!hasWaterAreas && waterAreaCount > 0) {
            hasWaterAreas = this.hasAdjacentWaterChunks(chunkX, chunkZ)
        }

        if (hasWaterAreas) {
            this.createWaterMesh(chunkX, chunkZ, chunkSize)
        }
    }

    // Альтернативный подход - создание воды на основе глобального анализа
    createWaterSurfaceAdvanced(chunkX: number, chunkZ: number, chunkSize: number): void {
        const chunkKey = `${chunkX},${chunkZ}`

        // Избегаем дублирования воды
        if (this.waterMeshes.has(chunkKey)) {
            return
        }

        // Анализируем более широкую область вокруг чанка
        const expandedArea = chunkSize * 1.5 // Расширяем область анализа
        const centerX = chunkX * chunkSize
        const centerZ = chunkZ * chunkSize

        let lowPoints = 0
        let totalPoints = 0

        // Проверяем расширенную область
        for (let x = -expandedArea / 2; x <= expandedArea / 2; x += chunkSize / 10) {
            for (let z = -expandedArea / 2; z <= expandedArea / 2; z += chunkSize / 10) {
                const worldX = centerX + x
                const worldZ = centerZ + z
                const height = this.heightGenerator.generateHeight(worldX, worldZ)

                totalPoints++
                if (height < this.waterLevel + 1) {
                    // Немного выше уровня воды тоже считаем
                    lowPoints++
                }
            }
        }

        const lowPointsPercent = lowPoints / totalPoints

        // Создаем воду если в расширенной области достаточно низких точек
        if (lowPointsPercent > 0.3) {
            // 30% низких точек в области
            this.createWaterMesh(chunkX, chunkZ, chunkSize)
        }
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

    private checkAdjacentWaterAreas(chunkX: number, chunkZ: number, chunkSize: number): boolean {
        // Проверяем границы с соседними чанками
        const borderPoints = [
            // Левая граница
            ...Array.from({ length: 5 }, (_, i) => [
                chunkX * chunkSize - chunkSize * 0.5,
                (i / 4 - 0.5) * chunkSize + chunkZ * chunkSize,
            ]),
            // Правая граница
            ...Array.from({ length: 5 }, (_, i) => [
                chunkX * chunkSize + chunkSize * 0.5,
                (i / 4 - 0.5) * chunkSize + chunkZ * chunkSize,
            ]),
            // Верхняя граница
            ...Array.from({ length: 5 }, (_, i) => [
                (i / 4 - 0.5) * chunkSize + chunkX * chunkSize,
                chunkZ * chunkSize - chunkSize * 0.5,
            ]),
            // Нижняя граница
            ...Array.from({ length: 5 }, (_, i) => [
                (i / 4 - 0.5) * chunkSize + chunkX * chunkSize,
                chunkZ * chunkSize + chunkSize * 0.5,
            ]),
        ]

        let deepBorderPoints = 0
        borderPoints.forEach(([x, z]) => {
            const height = this.heightGenerator.generateHeight(x, z)
            if (height < this.waterLevel) {
                deepBorderPoints++
            }
        })

        // Если более 20% граничных точек под водой, создаем воду для непрерывности
        return deepBorderPoints >= Math.ceil(borderPoints.length * 0.2)
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
