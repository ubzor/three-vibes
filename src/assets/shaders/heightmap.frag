uniform vec2 u_chunkOffset;
uniform vec2 u_chunkSize;
uniform vec2 u_resolution;
uniform float u_heightScale;
uniform float u_noiseScale;
uniform float u_time;
uniform vec4 u_noiseSeeds;
uniform float u_useFloatTexture;

varying vec2 vUv;

// Реализация шума
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
    
    // Генерируем высоту
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
    
    // Кодируем высоту в цвет в зависимости от типа текстуры
    float encodedHeight;
    if (u_useFloatTexture > 0.5) {
        // Для float текстур нормализуем в диапазон [0,1]
        encodedHeight = finalHeight / 100.0;
    } else {
        // Для byte текстур кодируем диапазон [-50,150] в [0,1]
        encodedHeight = (finalHeight + 50.0) / 200.0;
    }
    
    gl_FragColor = vec4(encodedHeight, 0.0, 0.0, 1.0);
}
