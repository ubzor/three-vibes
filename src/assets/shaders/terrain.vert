uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform float uSunIntensity;
uniform vec3 uAmbientColor;
uniform float uAmbientIntensity;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vFogFactor;

void main() {
    vColor = color;
    vNormal = normalize(normalMatrix * normal);
    
    // Мировая позиция для освещения
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Вычисляем туман
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float distance = length(mvPosition.xyz);
    vFogFactor = smoothstep(uFogNear, uFogFar, distance);
    
    gl_Position = projectionMatrix * mvPosition;
}
