import {
    Scene,
    WebGLRenderer,
    PerspectiveCamera,
    Color,
    Fog,
    PCFSoftShadowMap,
    SRGBColorSpace,
    ACESFilmicToneMapping,
} from 'three'
import { TerrainGenerator } from '../terrain/TerrainGenerator'
import { CameraController } from '../camera/CameraController'
import { LightingSystem } from '../lighting/LightingSystem'
import { UIControls } from '../utils/UIControls'
import { defaultSettings } from '../types/UISettings'
import { globalProfiler } from '../utils/Profiler'

export class LandscapeApp {
    private scene: Scene
    private renderer: WebGLRenderer
    private camera: PerspectiveCamera
    private terrainGenerator: TerrainGenerator
    private cameraController: CameraController
    private lightingSystem: LightingSystem
    private uiControls: UIControls
    private canvas: HTMLCanvasElement | null = null
    private isInitialized = false

    // FPS tracking variables
    private lastTime = 0
    private frameCount = 0
    private fps = 0
    private fpsUpdateInterval = 200 // Update FPS every 200ms for smoother updates
    private fpsHistory: number[] = [] // Store last few FPS values for averaging
    private maxFpsHistoryLength = 5 // Average over 5 measurements

    constructor() {
        this.scene = new Scene()
        this.renderer = new WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
        })
        this.camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000)

        this.terrainGenerator = new TerrainGenerator(this.scene, this.renderer)
        this.cameraController = new CameraController(this.camera)
        this.lightingSystem = new LightingSystem(this.scene)
        this.uiControls = new UIControls(this.onSettingsChange.bind(this))
    }

    async init(): Promise<void> {
        if (this.isInitialized) return

        globalProfiler.clear()
        globalProfiler.startStep('🚀 Application Initialization')

        try {
            globalProfiler.measure('📱 Canvas Setup', () => this.setupCanvas())
            globalProfiler.measure('🖥️ Renderer Setup', () => this.setupRenderer())
            globalProfiler.measure('🌍 Scene Setup', () => this.setupScene())
            await globalProfiler.measureAsync('🏔️ Terrain Setup', () => this.setupTerrain())
            globalProfiler.measure('💡 Lighting Setup', () => this.setupLighting())
            globalProfiler.measure('🎮 Controls Setup', () => this.setupControls())
            globalProfiler.measure('📡 Event Listeners Setup', () => this.setupEventListeners())

            globalProfiler.measure('🎨 UI Finalization', () => {
                this.hideLoading()
                this.startRenderLoop()
            })

            globalProfiler.endStep()

            // Выводим результаты профайлинга
            globalProfiler.printResults()
            this.printOptimizationSuggestions()

            this.isInitialized = true
        } catch (error) {
            globalProfiler.endStep()
            this.showError('Failed to load 3D landscape')
        }
    }

    private setupCanvas(): void {
        this.canvas = document.getElementById('landscape-canvas') as HTMLCanvasElement
        if (!this.canvas) {
            throw new Error('Canvas element not found')
        }
    }

    private setupRenderer(): void {
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        // Включаем тени обратно для красивого ландшафта
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = PCFSoftShadowMap
        this.renderer.outputColorSpace = SRGBColorSpace
        this.renderer.toneMapping = ACESFilmicToneMapping
        this.renderer.toneMappingExposure = 1.2

        // Clear color as fallback
        this.renderer.setClearColor(0x87ceeb, 1.0)

        if (this.canvas && this.canvas.parentElement) {
            this.canvas.parentElement.replaceChild(this.renderer.domElement, this.canvas)
            this.renderer.domElement.id = 'landscape-canvas'
        }
    }

    private setupScene(): void {
        this.scene.background = new Color(0x87ceeb) // Sky blue
        // Увеличиваем дальность тумана для лучшей видимости ландшафта
        this.scene.fog = new Fog(0x87ceeb, 150, 1000)

        // Set initial camera position closer to the center chunks
        this.camera.position.set(50, 50, 50)
        this.camera.lookAt(0, 0, 0) // Look at center of terrain

        // Make debug info available globally for debugging
        const debugInfo = {
            scene: this.scene,
            camera: this.camera,
            terrainGenerator: () => this.terrainGenerator,
        }
        ;(window as any).landscapeDebug = debugInfo
    }
    private async setupTerrain(): Promise<void> {
        await this.terrainGenerator.initialize()
        this.terrainGenerator.generateInitialChunks()
    }
    private setupLighting(): void {
        // Возвращаем профессиональную систему освещения
        this.lightingSystem.setupDayLighting()
        // Устанавливаем время по умолчанию из настроек
        this.lightingSystem.setTimeOfDay(defaultSettings.timeOfDay)

        // Связываем систему освещения с шейдерами
        const shaderManager = this.terrainGenerator.getShaderManager()
        this.lightingSystem.setShaderManager(shaderManager)
    }

    private setupControls(): void {
        this.cameraController.init(this.renderer.domElement)
        this.uiControls.init()

        // Force camera update after initialization
        setTimeout(() => {
            this.cameraController.update()
        }, 100)
    }

    private setupEventListeners(): void {
        window.addEventListener('resize', this.onWindowResize.bind(this))

        // Handle visibility change for performance
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseRendering()
            } else {
                this.resumeRendering()
            }
        })
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }
    private async onSettingsChange(settings: any): Promise<void> {
        if (settings.renderDistance !== undefined) {
            this.terrainGenerator.updateRenderDistance(settings.renderDistance)
        }
        if (settings.timeOfDay !== undefined) {
            this.lightingSystem.setTimeOfDay(settings.timeOfDay)
        }
        if (settings.showWireframe !== undefined) {
            this.terrainGenerator.setWireframe(settings.showWireframe)
        }
    }

    private startRenderLoop(): void {
        this.lastTime = performance.now()

        const animate = (currentTime: number) => {
            requestAnimationFrame(animate)

            if (!document.hidden) {
                // Calculate FPS
                this.calculateFPS(currentTime)

                this.update()
                this.render()
            }
        }
        animate(this.lastTime)
    }

    private calculateFPS(currentTime: number): void {
        this.frameCount++

        const deltaTime = currentTime - this.lastTime

        if (deltaTime >= this.fpsUpdateInterval) {
            // Calculate current FPS
            const currentFPS = (this.frameCount / deltaTime) * 1000

            // Add to history and maintain max length
            this.fpsHistory.push(currentFPS)
            if (this.fpsHistory.length > this.maxFpsHistoryLength) {
                this.fpsHistory.shift()
            }

            // Calculate average FPS for smoother display
            const averageFPS = this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length
            this.fps = averageFPS

            // Update UI with smoothed FPS
            this.uiControls.updateFPS(this.fps)

            // Reset counters
            this.frameCount = 0
            this.lastTime = currentTime
        }
    }

    private update(): void {
        this.cameraController.update()

        // Обновляем шейдеры с временем и позицией камеры
        const shaderManager = this.terrainGenerator.getShaderManager()
        const currentTime = performance.now() * 0.001 // Конвертируем в секунды
        shaderManager.updateTime(currentTime)
        shaderManager.updateCameraPosition(this.camera.position)

        this.terrainGenerator.update(this.camera.position)
        this.lightingSystem.update()

        // Update triangle count periodically (less frequently than FPS)
        if (this.frameCount % 30 === 0) {
            // Update every 30 frames
            this.updateTriangleCount()
        }
    }

    private updateTriangleCount(): void {
        let totalTriangles = 0

        // Count triangles in all objects in the scene
        this.scene.traverse(object => {
            if (object.type === 'Mesh') {
                const mesh = object as any
                if (mesh.geometry && mesh.geometry.index) {
                    totalTriangles += mesh.geometry.index.count / 3
                } else if (mesh.geometry && mesh.geometry.attributes.position) {
                    totalTriangles += mesh.geometry.attributes.position.count / 3
                }
            }
        })

        this.uiControls.updateTriangles(Math.floor(totalTriangles))
    }

    private render(): void {
        this.renderer.render(this.scene, this.camera)
    }

    private pauseRendering(): void {
        // Reduce update frequency when tab is not visible
    }

    private resumeRendering(): void {
        // Resume normal rendering
    }

    private hideLoading(): void {
        const loading = document.getElementById('loading')
        if (loading) {
            loading.style.display = 'none'
        }
    }

    private showError(message: string): void {
        const loading = document.getElementById('loading')
        if (loading) {
            loading.textContent = message
            loading.style.background = 'rgba(120, 0, 0, 0.8)'
        }
    }

    private printOptimizationSuggestions(): void {
        const totalTime = globalProfiler.getTotalTime()
        const slowestSteps = globalProfiler.getSlowestSteps(3)

        console.group('💡 Optimization Suggestions')
        console.log(`Total initialization time: ${totalTime.toFixed(2)}ms`)

        if (totalTime > 1000) {
            console.warn('⚠️ Initialization took longer than 1 second')
        }

        console.log('\n🐌 Slowest steps:')
        slowestSteps.forEach((step, index) => {
            const percentage = (((step.duration || 0) / totalTime) * 100).toFixed(1)
            console.log(`${index + 1}. ${step.name}: ${step.duration?.toFixed(2)}ms (${percentage}%)`)

            // Предложения по оптимизации
            if (step.name.includes('Terrain')) {
                console.log('   💡 Consider: Reduce initial chunk count or use lower resolution')
            }
            if (step.name.includes('GPU') && (step.duration || 0) > 100) {
                console.log('   💡 Consider: GPU might be busy, try CPU fallback')
            }
            if (step.name.includes('Biome') && (step.duration || 0) > 50) {
                console.log('   💡 Consider: Reduce biome object density')
            }
        })

        console.groupEnd()
    }

    dispose(): void {
        this.cameraController.dispose()
        this.terrainGenerator.dispose()
        this.renderer.dispose()
        window.removeEventListener('resize', this.onWindowResize.bind(this))
    }
}
