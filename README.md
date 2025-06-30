# 3D Procedural Landscape

A realistic 3D procedural landscape generator built with Three.js, TypeScript, and Vite.

## Features

- **Infinite Terrain**: Procedurally generated infinite terrain using noise functions
- **Multiple Biomes**: Forest, rocks, fields, sand, and water biomes
- **Realistic Graphics**: Dynamic lighting, shadows, and realistic materials
- **Isometric Camera**: Free-flying camera with isometric view controls
- **Performance Optimized**: Chunk-based loading and level-of-detail optimization (`TODO`)

## Biomes

- 🌲 **Forest**: Dense forests with trees and bushes
- 🏔️ **Rocks**: Mountain regions with rocks and boulders
- 🌾 **Fields**: Grassy plains with vegetation
- 🏖️ **Sand**: Beach and desert areas
- 🌊 **Water**: Rivers, lakes, and water bodies

## Controls

### Camera Movement

- **WASD** or **Arrow Keys** - Move around
- **Q/E** or **Page Up/Down** - Move up/down
- **Right Mouse Button** - Rotate camera
- **Middle Mouse Button** - Pan camera
- **Mouse Wheel** - Zoom in/out
- **Shift** - Speed boost

### Settings Panel

The right panel contains various controls to adjust:

- **Performance Monitoring**: Real-time FPS and triangle count display
- Terrain scale and complexity
- Render distance
- Time of day and lighting
- Wireframe mode

### Performance Monitoring

- **FPS Display**: Real-time frame rate with color-coded performance indicators
    - 🟢 Green: 60+ FPS (Excellent)
    - 🟡 Yellow: 30-59 FPS (Good)
    - 🔴 Red: <30 FPS (Poor)
- **Triangle Count**: Live display of rendered triangles for performance analysis

## Technical Details

### Architecture

- **Modular Design**: Separated into focused modules
- **TypeScript**: Full type safety and modern JavaScript features
- **Three.js**: WebGL rendering and 3D graphics
- **Perlin Noise**: Procedural terrain generation
- **Chunk System**: Infinite world with performance optimization

### Performance Features

- Chunk-based terrain loading/unloading
- Frustum culling
- Level-of-detail (LOD) system (`TODO`)
- Shadow map optimization
- Efficient material batching

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Project Structure

```
src/
├── core/           # Main application logic
├── terrain/        # Terrain generation system
├── biomes/         # Biome management and objects
├── camera/         # Camera controls
├── lighting/       # Lighting and shadows
├── materials/      # Materials and shaders
├── utils/          # Utilities and UI controls
└── shaders/        # Custom GLSL shaders
```

## Technologies Used

- **Three.js** - 3D graphics library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Perlin Noise** - Procedural noise generation

## Browser Support

Modern browsers with WebGL support:

- Chrome 51+
- Firefox 51+
- Safari 10+
- Edge 79+

## License

MIT License - see LICENSE file for details.
