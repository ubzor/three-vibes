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
