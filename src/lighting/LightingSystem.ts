import { Scene, DirectionalLight, AmbientLight, HemisphereLight, Vector3, MathUtils, PointLight, Color } from 'three'
import { ShaderManager, LightingUniforms } from '@/shaders/ShaderManager'

export class LightingSystem {
    private scene: Scene
    private sunLight!: DirectionalLight
    private moonLight!: DirectionalLight
    private ambientLight!: AmbientLight
    private skyLight!: HemisphereLight
    private sunPosition: Vector3
    private moonPosition: Vector3
    private timeOfDay: number = 0.5 // 0 = midnight, 0.5 = noon, 1 = midnight
    private shaderManager: ShaderManager | null = null

    constructor(scene: Scene) {
        this.scene = scene
        this.sunPosition = new Vector3()
        this.moonPosition = new Vector3()
        this.createLights()
    }

    setShaderManager(shaderManager: ShaderManager): void {
        this.shaderManager = shaderManager
        this.updateShaderLighting()
    }

    private createLights(): void {
        // Sun (directional light)
        this.sunLight = new DirectionalLight(0xffffff, 3.0)
        this.sunLight.position.set(100, 100, 50)
        this.sunLight.target.position.set(0, 0, 0)
        this.sunLight.castShadow = true
        this.sunLight.shadow.mapSize.width = 4096
        this.sunLight.shadow.mapSize.height = 4096
        this.sunLight.shadow.camera.near = 0.5
        this.sunLight.shadow.camera.far = 500
        this.sunLight.shadow.camera.left = -100
        this.sunLight.shadow.camera.right = 100
        this.sunLight.shadow.camera.top = 100
        this.sunLight.shadow.camera.bottom = -100
        this.sunLight.shadow.bias = -0.0001
        this.scene.add(this.sunLight)
        this.scene.add(this.sunLight.target)

        // Moon (directional light) - неяркий голубоватый свет
        this.moonLight = new DirectionalLight(0x88bbff, 0.3)
        this.moonLight.position.set(-100, 80, -50)
        this.moonLight.target.position.set(0, 0, 0)
        this.moonLight.castShadow = true
        this.moonLight.shadow.mapSize.width = 2048
        this.moonLight.shadow.mapSize.height = 2048
        this.moonLight.shadow.camera.near = 0.5
        this.moonLight.shadow.camera.far = 500
        this.moonLight.shadow.camera.left = -100
        this.moonLight.shadow.camera.right = 100
        this.moonLight.shadow.camera.top = 100
        this.moonLight.shadow.camera.bottom = -100
        this.moonLight.shadow.bias = -0.0001
        this.moonLight.visible = false // Изначально невидимый
        this.scene.add(this.moonLight)
        this.scene.add(this.moonLight.target)

        // Ambient light for overall brightness
        this.ambientLight = new AmbientLight(0x404040, 0.8)
        this.scene.add(this.ambientLight)

        // Sky light (hemisphere light) for realistic outdoor lighting
        this.skyLight = new HemisphereLight(0x87ceeb, 0x8b7355, 0.8)
        this.skyLight.position.set(0, 100, 0)
        this.scene.add(this.skyLight)
    }

    setupDayLighting(): void {
        this.timeOfDay = 0.5 // Noon
        this.updateSunPosition()
        this.updateLightColors()
        this.updateLightIntensity()
    }

    setupDawnLighting(): void {
        this.timeOfDay = 0.25 // Dawn/Morning
        this.updateSunPosition()
        this.updateLightColors()
        this.updateLightIntensity()
    }

    setupSunsetLighting(): void {
        this.timeOfDay = 0.75 // Sunset/Evening
        this.updateSunPosition()
        this.updateLightColors()
        this.updateLightIntensity()
    }

    setupNightLighting(): void {
        this.timeOfDay = 0.0 // Midnight
        this.updateSunPosition()
        this.updateLightColors()
        this.updateLightIntensity()
    }

    update(): void {
        // Animate time of day slowly (optional)
        // this.timeOfDay += 0.0001
        // if (this.timeOfDay > 1) this.timeOfDay = 0

        this.updateSunPosition()
        this.updateMoonPosition()
        this.updateLightColors()
        this.updateLightIntensity()

        // Обновляем шейдеры после всех изменений освещения
        this.updateShaderLighting()
    }

    private updateSunPosition(): void {
        // Calculate sun position based on time of day
        // timeOfDay: 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = sunset, 1 = midnight
        const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2
        const sunHeight = Math.sin(sunAngle)
        const sunDistance = Math.cos(sunAngle)

        this.sunPosition.set(sunDistance * 100, Math.max(sunHeight * 100, -20), sunDistance * 50)

        this.sunLight.position.copy(this.sunPosition)
        this.sunLight.target.position.set(0, 0, 0)
        this.sunLight.target.updateMatrixWorld()
    }

    private updateMoonPosition(): void {
        // Луна движется противоположно солнцу
        const moonAngle = (this.timeOfDay + 0.25) * Math.PI * 2
        const moonHeight = Math.sin(moonAngle)
        const moonDistance = Math.cos(moonAngle)

        this.moonPosition.set(moonDistance * 100, Math.max(moonHeight * 80, -20), moonDistance * 50)

        this.moonLight.position.copy(this.moonPosition)
        this.moonLight.target.position.set(0, 0, 0)
        this.moonLight.target.updateMatrixWorld()
    }

    private updateLightColors(): void {
        const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2
        const sunHeight = Math.sin(sunAngle)

        // Плавные переходы цветов с помощью интерполяции
        const sunColor = new Color()
        const skyColor = new Color()
        const groundColor = new Color()
        const ambientColor = new Color()

        if (sunHeight > 0.7) {
            // Высокое солнце - яркий белый/желтый
            sunColor.setHex(0xffffff)
            skyColor.setHex(0x87ceeb) // Небесно-голубой
            groundColor.setHex(0x8b7355) // Песочно-коричневый
            ambientColor.setHex(0x404040)
        } else if (sunHeight > 0.3) {
            // День - теплый белый
            sunColor.setHex(0xfff4e6)
            skyColor.setHex(0x87ceeb)
            groundColor.setHex(0x8b7355)
            ambientColor.setHex(0x404040)
        } else if (sunHeight > -0.1) {
            // Золотой час - плавный переход к оранжевому
            const t = MathUtils.smoothstep(sunHeight, -0.1, 0.3) // Плавная интерполяция

            // Смешиваем цвета от оранжевого заката к дневному свету
            const dayColor = new Color(0xfff4e6)
            const sunsetColor = new Color(0xff6633) // Ярко-оранжевый
            sunColor.lerpColors(sunsetColor, dayColor, t)

            const daySky = new Color(0x87ceeb)
            const sunsetSky = new Color(0xff8844) // Оранжево-красное небо
            skyColor.lerpColors(sunsetSky, daySky, t)

            const dayGround = new Color(0x8b7355)
            const sunsetGround = new Color(0x553311) // Темно-коричневый
            groundColor.lerpColors(sunsetGround, dayGround, t)

            const dayAmbient = new Color(0x404040)
            const sunsetAmbient = new Color(0x332211)
            ambientColor.lerpColors(sunsetAmbient, dayAmbient, t)
        } else if (sunHeight > -0.3) {
            // Сумерки - переход к ночи
            const t = MathUtils.smoothstep(sunHeight, -0.3, -0.1)

            const sunsetColor = new Color(0xff6633)
            const twilightColor = new Color(0x4466ff) // Глубокий синий
            sunColor.lerpColors(twilightColor, sunsetColor, t)

            const sunsetSky = new Color(0xff8844)
            const nightSky = new Color(0x001133) // Темно-синий
            skyColor.lerpColors(nightSky, sunsetSky, t)

            const sunsetGround = new Color(0x553311)
            const nightGround = new Color(0x001122)
            groundColor.lerpColors(nightGround, sunsetGround, t)

            const sunsetAmbient = new Color(0x332211)
            const nightAmbient = new Color(0x111133)
            ambientColor.lerpColors(nightAmbient, sunsetAmbient, t)
        } else {
            // Ночь - темно-синие тона
            sunColor.setHex(0x2244aa)
            skyColor.setHex(0x001133)
            groundColor.setHex(0x001122)
            ambientColor.setHex(0x111133)
        }

        // Применяем цвета
        this.sunLight.color.copy(sunColor)
        this.skyLight.color.copy(skyColor)
        this.skyLight.groundColor.copy(groundColor)
        this.ambientLight.color.copy(ambientColor)

        // Настройка лунного света
        const moonHeight = Math.sin((this.timeOfDay + 0.25) * Math.PI * 2)
        if (moonHeight > 0 && sunHeight < 0.1) {
            // Луна видна и солнце низко
            this.moonLight.visible = true
            const moonIntensity = Math.max(0, moonHeight) * 0.4
            this.moonLight.intensity = moonIntensity
            this.moonLight.color.setHex(0x88bbff) // Холодный голубоватый свет
        } else {
            this.moonLight.visible = false
        }
    }

    private updateLightIntensity(): void {
        const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2
        const sunHeight = Math.sin(sunAngle)

        // Плавные переходы интенсивности
        let sunIntensity = 0
        let ambientIntensity = 0
        let skyIntensity = 0

        if (sunHeight > 0.7) {
            // Высокое солнце - максимальная яркость
            sunIntensity = 3.5
            ambientIntensity = 0.8
            skyIntensity = 1.0
        } else if (sunHeight > 0.3) {
            // День - яркое освещение
            sunIntensity = 2.5
            ambientIntensity = 0.6
            skyIntensity = 0.8
        } else if (sunHeight > -0.1) {
            // Золотой час - плавный переход
            const t = MathUtils.smoothstep(sunHeight, -0.1, 0.3)
            sunIntensity = MathUtils.lerp(0.8, 2.5, t) // От заката к дню
            ambientIntensity = MathUtils.lerp(0.2, 0.6, t)
            skyIntensity = MathUtils.lerp(0.3, 0.8, t)
        } else if (sunHeight > -0.3) {
            // Сумерки
            const t = MathUtils.smoothstep(sunHeight, -0.3, -0.1)
            sunIntensity = MathUtils.lerp(0.1, 0.8, t)
            ambientIntensity = MathUtils.lerp(0.1, 0.2, t)
            skyIntensity = MathUtils.lerp(0.2, 0.3, t)
        } else {
            // Ночь - минимальное освещение от солнца
            sunIntensity = 0.05
            ambientIntensity = 0.1
            skyIntensity = 0.2
        }

        this.sunLight.intensity = sunIntensity
        this.ambientLight.intensity = ambientIntensity
        this.skyLight.intensity = skyIntensity
    }

    setTimeOfDay(time: number): void {
        this.timeOfDay = MathUtils.clamp(time, 0, 1)
        this.updateSunPosition()
        this.updateMoonPosition()
        this.updateLightColors()
        this.updateLightIntensity()
        // Обновляем шейдеры после изменения времени
        this.updateShaderLighting()
    }

    getSunDirection(): Vector3 {
        return this.sunPosition.clone().normalize()
    }

    getTimeOfDay(): number {
        return this.timeOfDay
    }

    addPointLight(
        position: Vector3,
        color: number = 0xffffff,
        intensity: number = 1,
        distance: number = 10
    ): PointLight {
        const pointLight = new PointLight(color, intensity, distance)
        pointLight.position.copy(position)
        pointLight.castShadow = true
        pointLight.shadow.mapSize.setScalar(512)
        this.scene.add(pointLight)
        return pointLight
    }

    private updateShaderLighting(): void {
        if (!this.shaderManager) return

        const lightingData: Partial<LightingUniforms> = {
            sunColor: this.sunLight.color,
            sunDirection: this.sunPosition.clone().normalize(),
            sunIntensity: this.sunLight.intensity,
            ambientColor: this.ambientLight.color,
            ambientIntensity: this.ambientLight.intensity,
            fogColor: this.scene.fog ? (this.scene.fog as any).color : new Color(0x87ceeb),
            fogNear: this.scene.fog ? (this.scene.fog as any).near : 150,
            fogFar: this.scene.fog ? (this.scene.fog as any).far : 1000,
        }

        this.shaderManager.updateLighting(lightingData)
    }

    dispose(): void {
        this.scene.remove(this.sunLight)
        this.scene.remove(this.moonLight)
        this.scene.remove(this.ambientLight)
        this.scene.remove(this.skyLight)
    }
}
