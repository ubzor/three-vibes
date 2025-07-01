import * as THREE from 'three'

// Импортируем шейдеры из папки assets
import heightmapVertexShader from '../assets/shaders/heightmap.vert?raw'
import heightmapFragmentShader from '../assets/shaders/heightmap.frag?raw'

export interface HeightmapConfig {
    chunkSize: number
    resolution: number
    heightScale: number
    noiseScale: number
    seed?: number
}

export class GPUHeightGenerator {
    private renderer: THREE.WebGLRenderer
    private initialized = false
    private config: HeightmapConfig

    // Shader resources
    private computeBuffer: THREE.BufferAttribute | null = null
    private computeMaterial: THREE.ShaderMaterial | null = null
    private computeGeometry: THREE.PlaneGeometry | null = null
    private computeMesh: THREE.Mesh | null = null
    private renderTarget: THREE.WebGLRenderTarget | null = null

    constructor(renderer: THREE.WebGLRenderer, config: HeightmapConfig) {
        this.renderer = renderer
        this.config = config
    }

    async initialize(): Promise<void> {
        if (this.initialized) return

        console.log('🚀 Starting GPU height generator initialization...')

        // Проверяем поддержку WebGL2 и необходимых расширений
        const gl = this.renderer.getContext()

        // Проверяем WebGL2
        if (!(gl instanceof WebGL2RenderingContext)) {
            console.error('❌ WebGL2 not supported')
            throw new Error('WebGL2 is required for GPU height generation')
        }
        console.log('✅ WebGL2 supported')

        // Проверяем поддержку float textures
        const floatExtension = gl.getExtension('EXT_color_buffer_float')
        if (!floatExtension) {
            console.warn('⚠️ Float textures not supported, using byte textures')
        } else {
            console.log('✅ Float textures supported')
        }

        try {
            // Создаем ресурсы для shader-based генерации (без compute shader)
            this.setupComputeResources()
            console.log('✅ Shader resources created successfully')
            this.initialized = true
        } catch (error) {
            console.error('❌ Failed to setup shader resources:', error)
            throw error
        }
    }

    private setupComputeResources(): void {
        const { resolution } = this.config

        console.log(`🔧 Setting up GPU resources with resolution: ${resolution}x${resolution}`)

        // Создаем буфер для результатов
        const bufferSize = resolution * resolution
        const buffer = new Float32Array(bufferSize)
        this.computeBuffer = new THREE.BufferAttribute(buffer, 1)

        // Проверяем поддержку float текстур
        const gl = this.renderer.getContext()
        let useFloatTexture = false

        if (gl instanceof WebGL2RenderingContext) {
            const floatExtension = gl.getExtension('EXT_color_buffer_float')
            useFloatTexture = !!floatExtension
        }

        console.log(`📊 Using ${useFloatTexture ? 'float' : 'byte'} textures`)

        // Создаем render target для fragment shader
        try {
            this.renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
                format: THREE.RGBAFormat,
                type: useFloatTexture ? THREE.FloatType : THREE.UnsignedByteType,
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
            })
            console.log('✅ Render target created successfully')
        } catch (error) {
            console.error('❌ Failed to create render target:', error)
            throw error
        }

        // Создаем материал с fragment shader
        try {
            this.computeMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    u_chunkOffset: { value: new THREE.Vector2(0, 0) },
                    u_chunkSize: { value: new THREE.Vector2(this.config.chunkSize, this.config.chunkSize) },
                    u_resolution: { value: new THREE.Vector2(resolution, resolution) },
                    u_heightScale: { value: this.config.heightScale },
                    u_noiseScale: { value: this.config.noiseScale },
                    u_time: { value: 0 },
                    u_noiseSeeds: { value: this.generateNoiseSeeds() },
                    u_useFloatTexture: { value: useFloatTexture ? 1.0 : 0.0 },
                },
                vertexShader: heightmapVertexShader,
                fragmentShader: heightmapFragmentShader,
            })
            console.log('✅ Shader material created successfully')
        } catch (error) {
            console.error('❌ Failed to create shader material:', error)
            throw error
        }

        // Создаем геометрию для полноэкранного quad
        try {
            this.computeGeometry = new THREE.PlaneGeometry(2, 2)
            this.computeMesh = new THREE.Mesh(this.computeGeometry, this.computeMaterial)
            console.log('✅ Render mesh created successfully')
        } catch (error) {
            console.error('❌ Failed to create render mesh:', error)
            throw error
        }
    }

    generateHeightmapGPU(chunkX: number, chunkZ: number): Promise<Float32Array> {
        return new Promise((resolve, reject) => {
            if (!this.initialized || !this.computeMaterial || !this.computeMesh || !this.renderTarget) {
                reject(new Error('GPU height generator not initialized'))
                return
            }

            try {
                const { chunkSize } = this.config

                // Обновляем uniforms
                this.computeMaterial.uniforms.u_chunkOffset.value.set(chunkX * chunkSize, chunkZ * chunkSize)
                this.computeMaterial.uniforms.u_time.value = performance.now() * 0.001

                // Создаем временную сцену и камеру для рендеринга
                const scene = new THREE.Scene()
                const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
                scene.add(this.computeMesh)

                // Рендерим в texture
                const oldRenderTarget = this.renderer.getRenderTarget()
                this.renderer.setRenderTarget(this.renderTarget)

                try {
                    this.renderer.render(scene, camera)
                } catch (renderError) {
                    this.renderer.setRenderTarget(oldRenderTarget)
                    reject(new Error(`Rendering failed: ${renderError}`))
                    return
                }

                this.renderer.setRenderTarget(oldRenderTarget)

                // Читаем результат
                const buffer = new Float32Array(this.config.resolution * this.config.resolution * 4)

                try {
                    this.renderer.readRenderTargetPixels(
                        this.renderTarget,
                        0,
                        0,
                        this.config.resolution,
                        this.config.resolution,
                        buffer
                    )
                } catch (readError) {
                    reject(new Error(`Failed to read render target pixels: ${readError}`))
                    return
                }

                // Извлекаем только R канал и масштабируем обратно
                const heights = new Float32Array(this.config.resolution * this.config.resolution)
                const isFloatTexture = this.renderTarget.texture.type === THREE.FloatType

                for (let i = 0; i < heights.length; i++) {
                    if (isFloatTexture) {
                        heights[i] = buffer[i * 4] * 100.0 // Декодируем из R канала для float
                    } else {
                        // Для byte текстур декодируем из [0,1] диапазона
                        heights[i] = (buffer[i * 4] / 255.0) * 200.0 - 50.0 // Диапазон [-50, 150]
                    }
                }

                resolve(heights)
            } catch (error) {
                reject(new Error(`GPU generation failed: ${error}`))
            }
        })
    }

    // Альтернативный метод с использованием transform feedback (если доступно)
    generateHeightmapGPUAdvanced(chunkX: number, chunkZ: number): Promise<Float32Array> {
        return new Promise((resolve, reject) => {
            // Здесь можно реализовать более продвинутую версию с transform feedback
            // или compute shaders, если WebGL поддерживает
            this.generateHeightmapGPU(chunkX, chunkZ).then(resolve).catch(reject)
        })
    }

    private generateNoiseSeeds(): THREE.Vector4 {
        const seed = this.config.seed || Math.random()

        // Используем простой генератор на основе seed
        const random = (s: number) => {
            const x = Math.sin(s) * 10000
            return x - Math.floor(x)
        }

        return new THREE.Vector4(
            random(seed) * 1000,
            random(seed * 2) * 1000,
            random(seed * 3) * 1000,
            random(seed * 4) * 1000
        )
    }

    updateConfig(newConfig: Partial<HeightmapConfig>): void {
        this.config = { ...this.config, ...newConfig }

        if (this.computeMaterial) {
            if (newConfig.heightScale !== undefined) {
                this.computeMaterial.uniforms.u_heightScale.value = newConfig.heightScale
            }
            if (newConfig.noiseScale !== undefined) {
                this.computeMaterial.uniforms.u_noiseScale.value = newConfig.noiseScale
            }
            if (newConfig.chunkSize !== undefined) {
                this.computeMaterial.uniforms.u_chunkSize.value.set(newConfig.chunkSize, newConfig.chunkSize)
            }
        }
    }

    dispose(): void {
        if (this.renderTarget) {
            this.renderTarget.dispose()
        }
        if (this.computeMaterial) {
            this.computeMaterial.dispose()
        }
        if (this.computeGeometry) {
            this.computeGeometry.dispose()
        }
        this.initialized = false
    }
}
