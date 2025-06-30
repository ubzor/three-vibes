export interface UISettings {
    terrainScale: number
    renderDistance: number
    timeOfDay: number
    showWireframe: boolean
    fogDensity: number
    fps: number
    triangles: number
}

export const defaultSettings: UISettings = {
    terrainScale: 0.02,
    renderDistance: 5,
    timeOfDay: 0.583, // 14:00 (2 PM)
    showWireframe: false,
    fogDensity: 0.01,
    fps: 0,
    triangles: 0,
}
