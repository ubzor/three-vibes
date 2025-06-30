<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# 3D Landscape Project Instructions

This is a Three.js TypeScript project for generating procedural 3D landscapes.

## Project Structure

- Use modular architecture with small, focused files
- Separate concerns: terrain generation, biomes, camera controls, lighting, etc.
- Use TypeScript strict mode and proper typing
- Follow Three.js best practices for performance

## Terrain Generation

- Use noise functions for procedural terrain
- Support multiple biomes: forest, rocks, fields, sand, water
- Implement infinite terrain with chunk-based loading
- Use realistic textures and materials

## Rendering

- Use realistic lighting and shadows
- Implement proper shaders for different materials
- Optimize for performance with LOD and culling
- Support isometric camera with free flight controls
