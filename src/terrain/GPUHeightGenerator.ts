import * as THREE from 'three'

export interface HeightmapConfig {
    chunkSize: number
    resolution: number
    heightScale: number
    noiseScale: number
    seed?: number
}

export class GPUHeightGenerator {
    private renderer: THREE.WebGLRenderer
    private computeShader: string = ''
    private initialized = false
    private config: HeightmapConfig

    // Compute shader resources
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

        // Проверяем поддержку compute shaders
        const gl = this.renderer.getContext()
        if (!gl.getExtension('EXT_disjoint_timer_query_webgl2')) {
            // WebGL2 compute shaders may not be fully supported
        }

        // Загружаем compute shader
        try {
            const response = await fetch('/src/assets/shaders/heightmap.comp')
            this.computeShader = await response.text()
        } catch (error) {
            throw error
        }

        // Создаем ресурсы для compute shader
        this.setupComputeResources()
        this.initialized = true
    }

    private setupComputeResources(): void {
        const { resolution } = this.config

        // Создаем буфер для результатов
        const bufferSize = resolution * resolution
        const buffer = new Float32Array(bufferSize)
        this.computeBuffer = new THREE.BufferAttribute(buffer, 1)

        // Создаем render target для compute shader
        this.renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
        })

        // Создаем материал с compute shader
        this.computeMaterial = new THREE.ShaderMaterial({
            uniforms: {
                u_chunkOffset: { value: new THREE.Vector2(0, 0) },
                u_chunkSize: { value: new THREE.Vector2(this.config.chunkSize, this.config.chunkSize) },
                u_resolution: { value: new THREE.Vector2(resolution, resolution) },
                u_heightScale: { value: this.config.heightScale },
                u_noiseScale: { value: this.config.noiseScale },
                u_time: { value: 0 },
                u_noiseSeeds: { value: this.generateNoiseSeeds() },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec2 u_chunkOffset;
                uniform vec2 u_chunkSize;
                uniform vec2 u_resolution;
                uniform float u_heightScale;
                uniform float u_noiseScale;
                uniform float u_time;
                uniform vec4 u_noiseSeeds;
                
                varying vec2 vUv;
                
                // Реализация шума (упрощенная версия из compute shader)
                vec2 hash(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    
                    return mix(mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                                   dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
                               mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                                   dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
                }

                float fractalNoise(vec2 p, int octaves, float persistence) {
                    float value = 0.0;
                    float amplitude = 1.0;
                    float frequency = 1.0;
                    float maxValue = 0.0;
                    
                    for (int i = 0; i < octaves; i++) {
                        value += noise(p * frequency) * amplitude;
                        maxValue += amplitude;
                        amplitude *= persistence;
                        frequency *= 2.0;
                    }
                    
                    return value / maxValue;
                }
                
                void main() {
                    vec2 coord = vUv * u_resolution;
                    vec2 worldPos = u_chunkOffset + coord * u_chunkSize / u_resolution;
                    vec2 noisePos = worldPos * u_noiseScale;
                    
                    // Генерируем высоту (логика из compute shader)
                    float baseHeight = fractalNoise(noisePos + u_noiseSeeds.xy, 6, 0.5);
                    float mountainNoise = noise((worldPos + u_noiseSeeds.zw) * 0.001);
                    float hillNoise = noise((worldPos + u_noiseSeeds.xy * 2.0) * 0.008);
                    float lakeNoise = noise((worldPos + u_noiseSeeds.zw * 0.5) * 0.002);
                    float riverNoise = noise((worldPos + u_noiseSeeds.xy * 0.7) * 0.004);
                    
                    float finalHeight = baseHeight * (u_heightScale * 0.8);
                    
                    if (lakeNoise < -0.75 || (riverNoise < -0.8 && lakeNoise < -0.5)) {
                        float lakeFactor = lakeNoise < -0.75 ? pow(abs(lakeNoise + 0.75) / 0.25, 1.5) : 0.0;
                        float riverFactor = (riverNoise < -0.8 && lakeNoise < -0.5) ? 
                                           pow(abs(riverNoise + 0.8) / 0.2, 2.0) : 0.0;
                        float depthFactor = max(lakeFactor, riverFactor);
                        finalHeight -= depthFactor * 8.0;
                    }
                    
                    if (mountainNoise > 0.2) {
                        float mountainFactor = pow((mountainNoise - 0.2) / 0.8, 1.2);
                        finalHeight += mountainFactor * 60.0;
                    }
                    
                    finalHeight += hillNoise * 12.0;
                    
                    float valleyNoise = noise((worldPos + u_noiseSeeds.xy * 1.3) * 0.005);
                    if (valleyNoise < -0.3) {
                        finalHeight *= 0.8;
                    }
                    
                    finalHeight += 5.0;
                    
                    // Кодируем высоту в цвет (R channel для основной высоты)
                    gl_FragColor = vec4(finalHeight / 100.0, 0.0, 0.0, 1.0);
                }
            `,
        })

        // Создаем геометрию для полноэкранного quad
        this.computeGeometry = new THREE.PlaneGeometry(2, 2)
        this.computeMesh = new THREE.Mesh(this.computeGeometry, this.computeMaterial)
    }

    generateHeightmapGPU(chunkX: number, chunkZ: number): Promise<Float32Array> {
        return new Promise((resolve, reject) => {
            if (!this.initialized || !this.computeMaterial || !this.computeMesh || !this.renderTarget) {
                reject(new Error('GPU height generator not initialized'))
                return
            }

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
            this.renderer.render(scene, camera)
            this.renderer.setRenderTarget(oldRenderTarget)

            // Читаем результат
            const buffer = new Float32Array(this.config.resolution * this.config.resolution * 4)
            this.renderer.readRenderTargetPixels(
                this.renderTarget,
                0,
                0,
                this.config.resolution,
                this.config.resolution,
                buffer
            )

            // Извлекаем только R канал и масштабируем обратно
            const heights = new Float32Array(this.config.resolution * this.config.resolution)
            for (let i = 0; i < heights.length; i++) {
                heights[i] = buffer[i * 4] * 100.0 // Декодируем из R канала
            }

            resolve(heights)
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
