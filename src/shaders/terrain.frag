uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform float uSunIntensity;
uniform vec3 uAmbientColor;
uniform float uAmbientIntensity;
uniform vec3 uFogColor;

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vFogFactor;

void main() {
    // Базовый цвет из вертексных цветов (биомы)
    vec3 baseColor = vColor;
    
    // Нормализуем нормаль
    vec3 normal = normalize(vNormal);
    
    // Диффузное освещение от солнца
    float ndotl = max(dot(normal, normalize(uSunDirection)), 0.0);
    vec3 diffuse = uSunColor * uSunIntensity * ndotl;
    
    // Ambient освещение
    vec3 ambient = uAmbientColor * uAmbientIntensity;
    
    // Простое "sky lighting" - дополнительное освещение сверху
    float skyFactor = max(dot(normal, vec3(0.0, 1.0, 0.0)), 0.0);
    vec3 skyLight = mix(uAmbientColor, vec3(0.4, 0.6, 1.0), 0.3) * 0.2 * skyFactor;
    
    // Комбинируем освещение
    vec3 lighting = ambient + diffuse + skyLight;
    
    // Применяем освещение к базовому цвету
    vec3 finalColor = baseColor * lighting;
    
    // Добавляем небольшую вариацию по высоте для более реалистичного вида
    float heightVariation = smoothstep(-10.0, 20.0, vWorldPosition.y);
    finalColor = mix(finalColor * 0.8, finalColor, heightVariation);
    
    // Применяем туман
    finalColor = mix(finalColor, uFogColor, vFogFactor);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
