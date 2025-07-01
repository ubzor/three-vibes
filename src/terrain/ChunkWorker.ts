// Веб-воркер для генерации геометрии чанков
export interface ChunkGenerationRequest {
    id: string
    chunkX: number
    chunkZ: number
    chunkSize: number
    chunkResolution: number
    heightGeneratorConfig: {
        seed: number
        scale: number
        heightScale: number
        octaves: number
        persistence: number
        lacunarity: number
    }
}

export interface ChunkGenerationResult {
    id: string
    chunkX: number
    chunkZ: number
    vertices: Float32Array
    indices: Uint32Array
    colors: Float32Array
    biomes: Uint8Array
    success: boolean
    error?: string
}

// Простая реализация Perlin noise для воркера
class PerlinNoise {
    private gradients: number[][]
    private permutation: number[]

    constructor(seed: number) {
        this.gradients = []
        this.permutation = []
        this.setupGradients()
        this.setupPermutation(seed)
    }

    private setupGradients(): void {
        for (let i = 0; i < 256; i++) {
            const angle = (i / 256) * 2 * Math.PI
            this.gradients[i] = [Math.cos(angle), Math.sin(angle)]
        }
    }

    private setupPermutation(seed: number): void {
        // Простой LCG для генерации последовательности
        let rng = seed
        const next = () => {
            rng = (rng * 1664525 + 1013904223) % 0x100000000
            return (rng >>> 0) / 0x100000000
        }

        for (let i = 0; i < 256; i++) {
            this.permutation[i] = i
        }

        // Перемешиваем массив
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(next() * (i + 1))
            const temp = this.permutation[i]
            this.permutation[i] = this.permutation[j]
            this.permutation[j] = temp
        }

        // Дублируем для избежания переполнения
        for (let i = 0; i < 256; i++) {
            this.permutation[i + 256] = this.permutation[i]
        }
    }

    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10)
    }

    private lerp(a: number, b: number, t: number): number {
        return a + t * (b - a)
    }

    private grad(hash: number, x: number, y: number): number {
        const gradient = this.gradients[hash & 255]
        return gradient[0] * x + gradient[1] * y
    }

    noise2D(x: number, y: number): number {
        const X = Math.floor(x) & 255
        const Y = Math.floor(y) & 255

        x -= Math.floor(x)
        y -= Math.floor(y)

        const u = this.fade(x)
        const v = this.fade(y)

        const a = this.permutation[X] + Y
        const aa = this.permutation[a]
        const ab = this.permutation[a + 1]
        const b = this.permutation[X + 1] + Y
        const ba = this.permutation[b]
        const bb = this.permutation[b + 1]

        return this.lerp(
            this.lerp(this.grad(this.permutation[aa], x, y), this.grad(this.permutation[ba], x - 1, y), u),
            this.lerp(this.grad(this.permutation[ab], x, y - 1), this.grad(this.permutation[bb], x - 1, y - 1), u),
            v
        )
    }
}

// Биомы (числовые значения)
const BiomeType = {
    WATER: 0,
    SAND: 1,
    FIELDS: 2,
    FOREST: 3,
    ROCKS: 4,
} as const

type BiomeTypeValue = (typeof BiomeType)[keyof typeof BiomeType]

// Цвета биомов
const biomeColors: Record<number, number[]> = {
    [BiomeType.WATER]: [0.231, 0.512, 0.965], // Синий
    [BiomeType.SAND]: [0.992, 0.906, 0.541], // Жёлтый песок
    [BiomeType.FIELDS]: [0.518, 0.8, 0.09], // Зелёные поля
    [BiomeType.FOREST]: [0.302, 0.486, 0.059], // Тёмно-зелёный лес
    [BiomeType.ROCKS]: [0.659, 0.639, 0.62], // Серые камни
}

// Генерация геометрии чанка
function generateChunkGeometry(request: ChunkGenerationRequest): ChunkGenerationResult {
    try {
        const { chunkX, chunkZ, chunkSize, chunkResolution, heightGeneratorConfig, id } = request

        // Создаём генератор шума
        const noise = new PerlinNoise(heightGeneratorConfig.seed)

        const vertices: number[] = []
        const indices: number[] = []
        const colors: number[] = []
        const biomes: number[] = []

        // Создаём vertices сетку
        for (let z = 0; z <= chunkResolution; z++) {
            for (let x = 0; x <= chunkResolution; x++) {
                const localX = (x / chunkResolution - 0.5) * chunkSize
                const localZ = (z / chunkResolution - 0.5) * chunkSize

                // Мировые координаты
                const worldX = localX + chunkX * chunkSize
                const worldZ = localZ + chunkZ * chunkSize

                // Генерируем высоту с помощью такой же логики как в HeightGenerator
                let baseHeight = 0
                let amplitude = 1
                let frequency = heightGeneratorConfig.scale

                // Генерируем базовую высоту с multiple octaves
                for (let i = 0; i < 6; i++) {
                    const noiseValue = noise.noise2D(worldX * frequency, worldZ * frequency)
                    baseHeight += noiseValue * amplitude
                    amplitude *= 0.5
                    frequency *= 2
                }

                // Добавляем крупномасштабные features (горы/равнины)
                const mountainNoise = noise.noise2D(worldX * 0.001, worldZ * 0.001)
                const hillNoise = noise.noise2D(worldX * 0.008, worldZ * 0.008)

                // Специальный шум для создания впадин/озер
                const lakeNoise = noise.noise2D(worldX * 0.002, worldZ * 0.002)
                const riverNoise = noise.noise2D(worldX * 0.004, worldZ * 0.004)

                // Создаём более разнообразный ландшафт
                let height = baseHeight * (heightGeneratorConfig.heightScale * 0.8)

                // Создаём глубокие впадины для озер/рек
                if (lakeNoise < -0.75 || (riverNoise < -0.8 && lakeNoise < -0.5)) {
                    const lakeFactor = lakeNoise < -0.75 ? Math.pow(Math.abs(lakeNoise + 0.75) / 0.25, 1.5) : 0
                    const riverFactor =
                        riverNoise < -0.8 && lakeNoise < -0.5 ? Math.pow(Math.abs(riverNoise + 0.8) / 0.2, 2) : 0
                    const depthFactor = Math.max(lakeFactor, riverFactor)
                    height -= depthFactor * 8
                }

                // Горы с более низким порогом и укрупненные
                if (mountainNoise > 0.2) {
                    const mountainFactor = Math.pow((mountainNoise - 0.2) / 0.8, 1.2)
                    height += mountainFactor * 60
                }

                // Увеличиваем влияние холмов для более разнообразного ландшафта
                height += hillNoise * 12

                // Создаём мягкие долины
                const valleyNoise = noise.noise2D(worldX * 0.005, worldZ * 0.005)
                if (valleyNoise < -0.3) {
                    height *= 0.8
                }

                // Поднимаем общий уровень равнин выше нуля
                height += 5

                vertices.push(localX, height, localZ)

                // Определяем биом
                const moisture = noise.noise2D(worldX * 0.01, worldZ * 0.01)
                const temperature = noise.noise2D((worldX + 1000) * 0.008, (worldZ + 1000) * 0.008)

                let biome: number = BiomeType.FIELDS
                if (height < 0)
                    biome = BiomeType.WATER // Изменено: теперь вода на уровне 0
                else if (height < 1 || (moisture > 0.3 && temperature > 0.1 && height < 3)) biome = BiomeType.SAND
                else if (height > 15) biome = BiomeType.ROCKS
                else if (moisture > -0.1 && temperature > -0.5 && height > 4 && height < 18) biome = BiomeType.FOREST

                biomes.push(biome)

                // Получаем цвет биома
                const color = biomeColors[biome] || biomeColors[BiomeType.FIELDS]
                colors.push(color[0], color[1], color[2])
            }
        }

        // Создаём indices для треугольников
        for (let z = 0; z < chunkResolution; z++) {
            for (let x = 0; x < chunkResolution; x++) {
                const a = z * (chunkResolution + 1) + x
                const b = z * (chunkResolution + 1) + x + 1
                const c = (z + 1) * (chunkResolution + 1) + x
                const d = (z + 1) * (chunkResolution + 1) + x + 1

                indices.push(a, c, b)
                indices.push(b, c, d)
            }
        }

        return {
            id,
            chunkX,
            chunkZ,
            vertices: new Float32Array(vertices),
            indices: new Uint32Array(indices),
            colors: new Float32Array(colors),
            biomes: new Uint8Array(biomes),
            success: true,
        }
    } catch (error) {
        return {
            id: request.id,
            chunkX: request.chunkX,
            chunkZ: request.chunkZ,
            vertices: new Float32Array(),
            indices: new Uint32Array(),
            colors: new Float32Array(),
            biomes: new Uint8Array(),
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}

// Обработчик сообщений воркера
self.onmessage = function (e: MessageEvent<ChunkGenerationRequest>) {
    const result = generateChunkGeometry(e.data)
    self.postMessage(result)
}
