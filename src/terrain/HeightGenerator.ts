import { Perlin } from 'ts-noise'

export class HeightGenerator {
    private perlin: Perlin
    private heightScale = 30
    private scale = 0.015

    constructor() {
        this.perlin = new Perlin(Math.random())
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
    }

    updateHeightScale(newHeightScale: number): void {
        this.heightScale = newHeightScale
    }

    // Публичный метод для доступа к шуму из других классов
    getNoise2D(x: number, z: number): number {
        return this.perlin.get2([x, z])
    }
}
