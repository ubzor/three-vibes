import {
    Color,
    MeshLambertMaterial,
    Group,
    CylinderGeometry,
    Mesh,
    SphereGeometry,
    PlaneGeometry,
    Object3D,
} from 'three'
import { globalProfiler } from '@/utils/Profiler'

export const BiomeType = {
    FOREST: 'forest',
    ROCKS: 'rocks',
    FIELDS: 'fields',
    SAND: 'sand',
    WATER: 'water',
} as const

export type BiomeTypeValue = (typeof BiomeType)[keyof typeof BiomeType]

interface BiomeConfig {
    baseColor: Color
    variations: Color[]
    objectTypes: string[]
}

export class BiomeManager {
    private biomeConfigs: Map<string, BiomeConfig> = new Map()
    private treeMaterial!: MeshLambertMaterial
    private rockMaterial!: MeshLambertMaterial
    private grassMaterial!: MeshLambertMaterial
    private wireframeEnabled = false

    constructor() {
        this.initializeBiomes()
        this.createMaterials()
    }

    async initialize(): Promise<void> {
        globalProfiler.startStep('🌿 Biome Configuration')

        globalProfiler.measure('🎨 Biome Colors Setup', () => this.initializeBiomes())
        globalProfiler.measure('🎭 Materials Creation', () => this.initializeMaterials())

        globalProfiler.endStep()
    }

    private initializeMaterials(): void {
        this.treeMaterial = new MeshLambertMaterial({ color: 0x4d7c0f })
        this.rockMaterial = new MeshLambertMaterial({ color: 0xa8a29e })
        this.grassMaterial = new MeshLambertMaterial({ color: 0x84cc16 })
    }

    private initializeBiomes(): void {
        this.biomeConfigs.set(BiomeType.FOREST, {
            baseColor: new Color(0x4d7c0f), // Более яркий зелёный
            variations: [new Color(0x22c55e), new Color(0x16a34a), new Color(0x15803d)],
            objectTypes: ['tree', 'bush'],
        })

        this.biomeConfigs.set(BiomeType.ROCKS, {
            baseColor: new Color(0xa8a29e), // Более светлый серый
            variations: [new Color(0xd6d3d1), new Color(0x78716c), new Color(0x57534e)],
            objectTypes: ['rock', 'boulder'],
        })

        this.biomeConfigs.set(BiomeType.FIELDS, {
            baseColor: new Color(0x84cc16), // Ярче салатовый
            variations: [new Color(0xa3e635), new Color(0x65a30d), new Color(0x4d7c0f)],
            objectTypes: ['grass', 'flower'],
        })

        this.biomeConfigs.set(BiomeType.SAND, {
            baseColor: new Color(0xfde68a), // Ярче жёлтый
            variations: [new Color(0xfef3c7), new Color(0xfcd34d), new Color(0xf59e0b)],
            objectTypes: ['driftwood', 'shell'],
        })

        this.biomeConfigs.set(BiomeType.WATER, {
            baseColor: new Color(0x3b82f6), // Ярче синий
            variations: [new Color(0x60a5fa), new Color(0x2563eb), new Color(0x1d4ed8)],
            objectTypes: [],
        })
    }

    private createMaterials(): void {
        this.treeMaterial = new MeshLambertMaterial({
            color: 0x8b4513, // Коричневый ствол
        })

        this.rockMaterial = new MeshLambertMaterial({
            color: 0xa8a29e, // Светло-серый камень
        })

        this.grassMaterial = new MeshLambertMaterial({
            color: 0x22c55e, // Ярко-зелёная трава
        })
    }

    getBiomeColor(biome: string, height: number): Color {
        const config = this.biomeConfigs.get(biome)
        if (!config) return new Color(0x808080)

        const heightFactor = Math.max(0, Math.min(1, (height + 10) / 40))
        const variationIndex = Math.floor(heightFactor * config.variations.length)
        const selectedVariation = config.variations[Math.min(variationIndex, config.variations.length - 1)]

        const mixFactor = (heightFactor * config.variations.length) % 1
        return config.baseColor.clone().lerp(selectedVariation, mixFactor)
    }

    createBiomeObject(biome: string, height: number): Object3D | null {
        const config = this.biomeConfigs.get(biome)
        if (!config || config.objectTypes.length === 0) return null

        const objectType = config.objectTypes[Math.floor(Math.random() * config.objectTypes.length)]

        switch (objectType) {
            case 'tree':
                return this.createTree(height)
            case 'rock':
                return this.createRock(height)
            case 'boulder':
                return this.createBoulder(height)
            case 'grass':
                return this.createGrass()
            case 'bush':
                return this.createBush()
            default:
                return null
        }
    }

    private createTree(height: number = 0): Object3D {
        const tree = new Group()

        // Размер дерева зависит от высоты - на высоких местах деревья меньше
        const sizeFactor = Math.max(0.5, 1 - height * 0.02)
        const trunkHeight = (3 + Math.random() * 2) * sizeFactor
        const trunkRadius = (0.2 + Math.random() * 0.2) * sizeFactor

        // Trunk
        const trunkGeometry = new CylinderGeometry(trunkRadius, trunkRadius * 1.2, trunkHeight, 8)
        const trunk = new Mesh(trunkGeometry, this.treeMaterial)
        trunk.position.y = trunkHeight / 2
        tree.add(trunk)

        // Leaves - варьируем цвет листвы
        const leavesSize = (1.5 + Math.random() * 1) * sizeFactor
        const leavesGeometry = new SphereGeometry(leavesSize, 8, 6)
        const leafColor = new Color().setHSL(0.25 + Math.random() * 0.1, 0.6, 0.3 + Math.random() * 0.2)
        const leavesMaterial = new MeshLambertMaterial({ color: leafColor })
        leavesMaterial.wireframe = this.wireframeEnabled
        const leaves = new Mesh(leavesGeometry, leavesMaterial)
        leaves.position.y = trunkHeight + leavesSize * 0.7
        tree.add(leaves)

        return tree
    }

    private createRock(height: number = 0): Object3D {
        // На больших высотах камни более остроугольные
        const sharpness = Math.min(1, height * 0.05)
        const size = 0.3 + Math.random() * 0.4
        const rockGeometry = new SphereGeometry(size, Math.max(4, 8 - sharpness * 4), Math.max(3, 6 - sharpness * 3))
        const rock = new Mesh(rockGeometry, this.rockMaterial)
        rock.scale.y = 0.4 + Math.random() * 0.6
        rock.rotation.y = Math.random() * Math.PI * 2
        return rock
    }

    private createBoulder(height: number = 0): Object3D {
        const size = 0.8 + Math.random() * 0.7
        const boulderGeometry = new SphereGeometry(size, 8, 6)
        const boulder = new Mesh(boulderGeometry, this.rockMaterial)
        boulder.scale.y = 0.6 + Math.random() * 0.4
        boulder.rotation.y = Math.random() * Math.PI * 2
        return boulder
    }

    private createGrass(): Object3D {
        const grassGeometry = new PlaneGeometry(0.5, 1)
        const grass = new Mesh(grassGeometry, this.grassMaterial)
        grass.rotation.x = Math.PI / 2
        return grass
    }

    private createBush(): Object3D {
        const bushGeometry = new SphereGeometry(0.8, 6, 4)
        const bushMaterial = new MeshLambertMaterial({ color: 0x228b22 })
        bushMaterial.wireframe = this.wireframeEnabled
        const bush = new Mesh(bushGeometry, bushMaterial)
        bush.scale.y = 0.6
        return bush
    }

    setWireframe(enabled: boolean): void {
        this.wireframeEnabled = enabled
        this.treeMaterial.wireframe = enabled
        this.rockMaterial.wireframe = enabled
        this.grassMaterial.wireframe = enabled
    }
}
