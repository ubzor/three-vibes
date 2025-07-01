import { ShaderMaterial, Vector3, Color } from 'three'

// Импортируем шейдеры как модули
const terrainVertexShader = `
uniform vec3 uSunDirection;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vColor;
varying vec3 vNormal;
varying float vLighting;
varying float vFogFactor;

void main() {
    vColor = color;
    vNormal = normalize(normalMatrix * normal);
    
    // Простое диффузное освещение
    float ndotl = max(dot(vNormal, normalize(uSunDirection)), 0.0);
    vLighting = 0.3 + ndotl * 0.7; // ambient + diffuse
    
    // Вычисляем туман
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float distance = length(mvPosition.xyz);
    vFogFactor = smoothstep(uFogNear, uFogFar, distance);
    
    gl_Position = projectionMatrix * mvPosition;
}
`

const terrainFragmentShader = `
uniform vec3 uFogColor;

varying vec3 vColor;
varying float vLighting;
varying float vFogFactor;

void main() {
    vec3 finalColor = vColor * vLighting;
    
    // Применяем туман
    finalColor = mix(finalColor, uFogColor, vFogFactor);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`

const waterVertexShader = `
uniform float uTime;
uniform vec3 uCameraPosition;

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec2 vUv;

void main() {
    // UV координаты для волн
    vUv = position.xz * 0.01; // Масштабируем для паттерна волн
    
    // Мировая позиция
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Создаем волны
    float waveHeight = 0.0;
    
    // Первая волна
    float wave1 = sin(worldPosition.x * 0.02 + uTime * 2.0) * 0.3;
    // Вторая волна
    float wave2 = sin(worldPosition.z * 0.015 + uTime * 1.5) * 0.2;
    // Третья волна (диагональная)
    float wave3 = sin((worldPosition.x + worldPosition.z) * 0.01 + uTime * 1.2) * 0.15;
    
    waveHeight = wave1 + wave2 + wave3;
    
    // Применяем волны к позиции
    vec3 newPosition = position;
    newPosition.y += waveHeight;
    
    vPosition = newPosition;
    vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
    vViewPosition = -mvPosition.xyz;
    
    gl_Position = projectionMatrix * mvPosition;
}
`

const waterFragmentShader = `
uniform float uTime;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform float uSunIntensity;
uniform vec3 uAmbientColor;
uniform float uAmbientIntensity;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uCameraPosition;

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec2 vUv;

void main() {
    // Более глубокий и насыщенный цвет воды
    vec3 deepWaterColor = vec3(0.1, 0.2, 0.4);
    vec3 shallowWaterColor = vec3(0.2, 0.4, 0.7);
    
    // Вычисляем нормаль для волн (более детальную)
    float time = uTime * 0.5;
    float dx1 = sin(vWorldPosition.x * 0.02 + time * 2.0) * 0.02;
    float dz1 = sin(vWorldPosition.z * 0.015 + time * 1.5) * 0.015;
    float dx2 = sin(vWorldPosition.x * 0.05 + time * 3.0) * 0.01;
    float dz2 = sin(vWorldPosition.z * 0.04 + time * 2.5) * 0.01;
    
    vec3 normal = normalize(vec3(-(dx1 + dx2), 1.0, -(dz1 + dz2)));
    
    // Направление к камере
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    
    // Диффузное освещение
    float ndotl = max(dot(normal, normalize(uSunDirection)), 0.0);
    vec3 diffuse = uSunColor * uSunIntensity * ndotl * 0.6;
    
    // Спекулярное отражение (Blinn-Phong)
    vec3 halfVector = normalize(normalize(uSunDirection) + viewDir);
    float specular = pow(max(dot(normal, halfVector), 0.0), 64.0);
    vec3 specularColor = uSunColor * specular * 0.8;
    
    // Ambient освещение
    vec3 ambient = uAmbientColor * uAmbientIntensity;
    
    // Эффект Френеля для реалистичности
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);
    
    // Смешиваем цвета воды в зависимости от угла обзора
    vec3 waterColor = mix(deepWaterColor, shallowWaterColor, fresnel);
    
    // Анимированные рефлексы и каустики
    float caustics = sin(vUv.x * 20.0 + time * 4.0) * sin(vUv.y * 25.0 + time * 3.0);
    caustics = caustics * 0.1 + 0.9;
    
    // Имитация подводного света
    float underwaterGlow = max(0.0, sin(vWorldPosition.x * 0.01 + time) * sin(vWorldPosition.z * 0.01 + time * 1.3)) * 0.2;
    
    // Комбинируем освещение
    vec3 finalColor = (waterColor + ambient + diffuse + specularColor) * caustics + underwaterGlow;
    
    // Альфа-канал для прозрачности (более прозрачная на мелководье)
    float alpha = mix(0.8, 0.95, fresnel);
    
    // Fog calculation
    float distance = length(vViewPosition);
    float fogFactor = smoothstep(uFogNear, uFogFar, distance);
    finalColor = mix(finalColor, uFogColor, fogFactor);
    
    gl_FragColor = vec4(finalColor, alpha);
}
`

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
        })
    }

    getTerrainMaterial(): ShaderMaterial {
        return this.terrainMaterial
    }

    getWaterMaterial(): ShaderMaterial {
        return this.waterMaterial
    }

    createNewTerrainMaterial(): ShaderMaterial {
        return this.createTerrainMaterial()
    }

    createNewWaterMaterial(): ShaderMaterial {
        return this.createWaterMaterial()
    }

    updateLighting(lightingData: Partial<LightingUniforms>): void {
        // Обновляем внутренние uniform значения
        Object.assign(this.lightingUniforms, lightingData)

        // Обновляем основные материалы
        this.updateMaterialLighting(this.terrainMaterial, lightingData)
        this.updateMaterialLighting(this.waterMaterial, lightingData)
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
        this.terrainMaterial.uniforms.uTime.value = time
        this.waterMaterial.uniforms.uTime.value = time
    }

    updateCameraPosition(position: Vector3): void {
        this.terrainMaterial.uniforms.uCameraPosition.value.copy(position)
        this.waterMaterial.uniforms.uCameraPosition.value.copy(position)
    }

    dispose(): void {
        this.terrainMaterial.dispose()
        this.waterMaterial.dispose()
    }
}
