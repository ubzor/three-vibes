import { createNoise2D } from 'simplex-noise'

export class HeightGenerator {
    private noise2D: any
    private heightScale = 30
    private scale = 0.015

    constructor() {
        this.noise2D = createNoise2D()
    }

    generateHeight(x: number, z: number): number {
        // Базовая высота terrain с несколькими октавами
        let baseHeight = 0
        let amplitude = 1
        let frequency = this.scale

        // Генерируем базовую высоту с multiple octaves
        for (let i = 0; i < 6; i++) {
            const noiseValue = this.noise2D(x * frequency, z * frequency)
            baseHeight += noiseValue * amplitude
            amplitude *= 0.5
            frequency *= 2
        }

        // Добавляем крупномасштабные features (горы/равнины)
        const mountainNoise = this.noise2D(x * 0.002, z * 0.002) // Делаем горы реже
        const hillNoise = this.noise2D(x * 0.008, z * 0.008)

        // Специальный шум для создания впадин/озер - делаем их более связанными
        const lakeNoise = this.noise2D(x * 0.003, z * 0.003) // Уменьшаем частоту для больших озер
        const riverNoise = this.noise2D(x * 0.006, z * 0.006) // Дополнительный шум для рек

        // Создаём более мягкий ландшафт с преобладанием равнин
        let finalHeight = baseHeight * (this.heightScale * 0.6) // Уменьшаем общую высоту

        // Создаём глубокие впадины для озер/рек - более гибкие условия
        if (lakeNoise < -0.6 || (riverNoise < -0.7 && lakeNoise < -0.3)) {
            const lakeFactor = lakeNoise < -0.6 ? Math.pow(Math.abs(lakeNoise + 0.6) / 0.4, 1.5) : 0
            const riverFactor =
                riverNoise < -0.7 && lakeNoise < -0.3 ? Math.pow(Math.abs(riverNoise + 0.7) / 0.3, 2) : 0
            const depthFactor = Math.max(lakeFactor, riverFactor)
            finalHeight -= depthFactor * 8 // Уменьшаем глубину впадин для более плавных переходов
        }

        // Горы только в очень редких случаях - в 10 раз реже
        if (mountainNoise > 0.7) {
            // Было 0.2, стало 0.7 (гораздо реже)
            const mountainFactor = Math.pow((mountainNoise - 0.7) / 0.3, 2)
            finalHeight += mountainFactor * 35 // Немного снижаем высоту гор
        }

        // Увеличиваем влияние холмов для более разнообразного ландшафта
        finalHeight += hillNoise * 12

        // Создаём мягкие долины
        const valleyNoise = this.noise2D(x * 0.005, z * 0.005)
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
        return this.noise2D(x, z)
    }
}
