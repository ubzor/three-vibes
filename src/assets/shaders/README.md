# Шейдеры для 3D ландшафта

Эта папка содержит все GLSL шейдеры, используемые в проекте.

## Структура файлов

### Terrain Shaders (Террейн)

- `terrain.vert` - Vertex shader для террейна
- `terrain.frag` - Fragment shader для террейна

### Water Shaders (Вода)

- `water.vert` - Vertex shader для воды с анимацией волн
- `water.frag` - Fragment shader для воды с эффектами освещения

### Wireframe Shaders (Каркас)

- `wireframe.vert` - Vertex shader для режима wireframe
- `wireframe.frag` - Fragment shader для режима wireframe

### Compute Shaders (Вычислительные)

- `heightmap.comp` - Compute shader для генерации карт высот на GPU

## Использование

Шейдеры импортируются в TypeScript коде с помощью Vite:

```typescript
import terrainVertexShader from '../assets/shaders/terrain.vert?raw'
import terrainFragmentShader from '../assets/shaders/terrain.frag?raw'
```

## Особенности

- Все шейдеры используют общую систему освещения с uniforms
- Поддержка туман (fog) для атмосферных эффектов
- Анимация времени через uniform `uTime`
- Динамические эффекты воды с волнами и каустикой
- GPU-ускоренная генерация террейна через compute shaders

## Редактирование

При изменении шейдеров Vite автоматически перезагрузит модули благодаря HMR (Hot Module Replacement).
