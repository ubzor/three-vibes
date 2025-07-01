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
