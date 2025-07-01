import { ShaderMaterial, Vector3, Color, MeshBasicMaterial } from 'three'

// Импортируем шейдеры из папки assets
import terrainVertexShader from '../assets/shaders/terrain.vert?raw'
import terrainFragmentShader from '../assets/shaders/terrain.frag?raw'
import waterVertexShader from '../assets/shaders/water.vert?raw'
import waterFragmentShader from '../assets/shaders/water.frag?raw'
import wireframeVertexShader from '../assets/shaders/wireframe.vert?raw'
import wireframeFragmentShader from '../assets/shaders/wireframe.frag?raw'

export interface LightingUniforms {
    sunColor: Color
    sunDirection: Vector3
    sunIntensity: number
    ambientColor: Color
    ambientIntensity: number
    fogColor: Color
    fogNear: number
    fogFar: number
}

export class ShaderManager {
    private terrainMaterial: ShaderMaterial
    private waterMaterial: ShaderMaterial
    private lightingUniforms: LightingUniforms
    private allTerrainMaterials: Set<ShaderMaterial> = new Set()
    private allWaterMaterials: Set<ShaderMaterial> = new Set()
    private wireframeEnabled = false
    private terrainWireframeMaterial: ShaderMaterial
    private waterWireframeMaterial: ShaderMaterial

    constructor() {
        this.lightingUniforms = {
            sunColor: new Color(0xffffff),
            sunDirection: new Vector3(1, 1, 0).normalize(),
            sunIntensity: 1.0,
            ambientColor: new Color(0x404040),
            ambientIntensity: 0.8,
            fogColor: new Color(0x87ceeb),
            fogNear: 150,
            fogFar: 1000,
        }

        this.terrainMaterial = this.createTerrainMaterial()
        this.waterMaterial = this.createWaterMaterial()

        // Создаем wireframe материалы
        this.terrainWireframeMaterial = new ShaderMaterial({
            uniforms: {
                uWireframeColor: { value: new Color(0x000000) }, // Черный для террейна
            },
            vertexShader: wireframeVertexShader,
            fragmentShader: wireframeFragmentShader,
            wireframe: true,
        })

        this.waterWireframeMaterial = new ShaderMaterial({
            uniforms: {
                uWireframeColor: { value: new Color(0x0066ff) }, // Синий для воды
            },
            vertexShader: wireframeVertexShader,
            fragmentShader: wireframeFragmentShader,
            wireframe: true,
            transparent: true,
        })

        // Добавляем основные материалы в отслеживание
        this.allTerrainMaterials.add(this.terrainMaterial)
        this.allWaterMaterials.add(this.waterMaterial)
    }

    private createTerrainMaterial(): ShaderMaterial {
        const uniforms = {
            // Lighting uniforms
            uSunColor: { value: this.lightingUniforms.sunColor.clone() },
            uSunDirection: { value: this.lightingUniforms.sunDirection.clone() },
            uSunIntensity: { value: this.lightingUniforms.sunIntensity },
            uAmbientColor: { value: this.lightingUniforms.ambientColor.clone() },
            uAmbientIntensity: { value: this.lightingUniforms.ambientIntensity },
            uFogColor: { value: this.lightingUniforms.fogColor.clone() },
            uFogNear: { value: this.lightingUniforms.fogNear },
            uFogFar: { value: this.lightingUniforms.fogFar },

            // Animation uniforms
            uTime: { value: 0.0 },
            uCameraPosition: { value: new Vector3() },
        }

        return new ShaderMaterial({
            uniforms,
            vertexShader: terrainVertexShader,
            fragmentShader: terrainFragmentShader,
            vertexColors: true,
            transparent: false,
            depthWrite: true,
            depthTest: true,
            wireframe: false,
        })
    }

    private createWaterMaterial(): ShaderMaterial {
        const uniforms = {
            // Lighting uniforms
            uSunColor: { value: this.lightingUniforms.sunColor.clone() },
            uSunDirection: { value: this.lightingUniforms.sunDirection.clone() },
            uSunIntensity: { value: this.lightingUniforms.sunIntensity },
            uAmbientColor: { value: this.lightingUniforms.ambientColor.clone() },
            uAmbientIntensity: { value: this.lightingUniforms.ambientIntensity },
            uFogColor: { value: this.lightingUniforms.fogColor.clone() },
            uFogNear: { value: this.lightingUniforms.fogNear },
            uFogFar: { value: this.lightingUniforms.fogFar },

            // Animation uniforms
            uTime: { value: 0.0 },
            uCameraPosition: { value: new Vector3() },
        }

        return new ShaderMaterial({
            uniforms,
            vertexShader: waterVertexShader,
            fragmentShader: waterFragmentShader,
            transparent: true,
            depthWrite: false,
            wireframe: false,
        })
    }

    getTerrainMaterial(): ShaderMaterial {
        return this.terrainMaterial
    }

    getWaterMaterial(): ShaderMaterial {
        return this.waterMaterial
    }

    createNewTerrainMaterial(): ShaderMaterial {
        const material = this.createTerrainMaterial()
        material.wireframe = this.wireframeEnabled
        this.allTerrainMaterials.add(material)
        return material
    }

    createNewWaterMaterial(): ShaderMaterial {
        const material = this.createWaterMaterial()
        material.wireframe = this.wireframeEnabled
        this.allWaterMaterials.add(material)
        return material
    }

    updateLighting(lightingData: Partial<LightingUniforms>): void {
        // Обновляем внутренние uniform значения
        Object.assign(this.lightingUniforms, lightingData)

        // Обновляем ВСЕ материалы террейна
        this.allTerrainMaterials.forEach(material => {
            this.updateMaterialLighting(material, lightingData)
        })

        // Обновляем ВСЕ материалы воды
        this.allWaterMaterials.forEach(material => {
            this.updateMaterialLighting(material, lightingData)
        })
    }

    private updateMaterialLighting(material: ShaderMaterial, lightingData: Partial<LightingUniforms>): void {
        if (lightingData.sunColor && material.uniforms.uSunColor) {
            material.uniforms.uSunColor.value.copy(lightingData.sunColor)
        }
        if (lightingData.sunDirection && material.uniforms.uSunDirection) {
            material.uniforms.uSunDirection.value.copy(lightingData.sunDirection)
        }
        if (lightingData.sunIntensity !== undefined && material.uniforms.uSunIntensity) {
            material.uniforms.uSunIntensity.value = lightingData.sunIntensity
        }
        if (lightingData.ambientColor && material.uniforms.uAmbientColor) {
            material.uniforms.uAmbientColor.value.copy(lightingData.ambientColor)
        }
        if (lightingData.ambientIntensity !== undefined && material.uniforms.uAmbientIntensity) {
            material.uniforms.uAmbientIntensity.value = lightingData.ambientIntensity
        }
        if (lightingData.fogColor && material.uniforms.uFogColor) {
            material.uniforms.uFogColor.value.copy(lightingData.fogColor)
        }
        if (lightingData.fogNear !== undefined && material.uniforms.uFogNear) {
            material.uniforms.uFogNear.value = lightingData.fogNear
        }
        if (lightingData.fogFar !== undefined && material.uniforms.uFogFar) {
            material.uniforms.uFogFar.value = lightingData.fogFar
        }
    }

    updateTime(time: number): void {
        this.allTerrainMaterials.forEach(material => {
            if (material.uniforms.uTime) {
                material.uniforms.uTime.value = time
            }
        })
        this.allWaterMaterials.forEach(material => {
            if (material.uniforms.uTime) {
                material.uniforms.uTime.value = time
            }
        })
    }

    updateCameraPosition(position: Vector3): void {
        this.allTerrainMaterials.forEach(material => {
            if (material.uniforms.uCameraPosition) {
                material.uniforms.uCameraPosition.value.copy(position)
            }
        })
        this.allWaterMaterials.forEach(material => {
            if (material.uniforms.uCameraPosition) {
                material.uniforms.uCameraPosition.value.copy(position)
            }
        })
    }

    dispose(): void {
        this.allTerrainMaterials.forEach(material => material.dispose())
        this.allWaterMaterials.forEach(material => material.dispose())
        this.allTerrainMaterials.clear()
        this.allWaterMaterials.clear()
    }

    // Метод для удаления материала из отслеживания
    removeMaterial(material: ShaderMaterial): void {
        this.allTerrainMaterials.delete(material)
        this.allWaterMaterials.delete(material)
    }

    setWireframe(enabled: boolean): void {
        this.wireframeEnabled = enabled

        // Применяем wireframe ко всем существующим материалам
        this.allTerrainMaterials.forEach(material => {
            material.wireframe = enabled
        })
        this.allWaterMaterials.forEach(material => {
            material.wireframe = enabled
        })
    }

    getTerrainWireframeMaterial(): ShaderMaterial {
        return this.terrainWireframeMaterial
    }

    getWaterWireframeMaterial(): ShaderMaterial {
        return this.waterWireframeMaterial
    }
}
