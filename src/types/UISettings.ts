export interface UISettings {
    renderDistance: number
    timeOfDay: number
    showWireframe: boolean
    fogDensity: number
    fps: number
    triangles: number
    workerStats?: any
}

export const defaultSettings: UISettings = {
    renderDistance: 6,
    timeOfDay: 0.583, // 14:00 (2 PM)
    showWireframe: false,
    fogDensity: 0.01,
    fps: 0,
    triangles: 0,
    workerStats: null,
}
