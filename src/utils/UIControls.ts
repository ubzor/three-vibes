import UIControlsComponent from '../components/UIControls.svelte'
import { mount } from 'svelte'
import type { UISettings } from '../types/UISettings'
import { defaultSettings } from '../types/UISettings'

export class UIControls {
    private component: any = null
    private container: HTMLElement | null = null
    private settings: UISettings
    private onSettingsChange: (settings: Partial<UISettings>) => void

    constructor(onSettingsChange: (settings: Partial<UISettings>) => void) {
        this.onSettingsChange = onSettingsChange
        this.settings = { ...defaultSettings }
    }

    init(): void {
        this.container = document.getElementById('controls')
        if (!this.container) {
            return
        }

        try {
            this.component = mount(UIControlsComponent, {
                target: this.container,
                props: {
                    visible: true,
                    onSettingsChange: (changes: Partial<UISettings>) => {
                        Object.assign(this.settings, changes)
                        this.onSettingsChange(changes)
                    },
                },
            })
        } catch (error) {
            // Silent error handling
        }
    }

    updateFPS(fps: number): void {
        this.settings.fps = fps
        // Используем экспортированную функцию компонента
        if (this.component && this.component.updateFPS) {
            this.component.updateFPS(fps)
        }
    }

    updateTriangles(triangles: number): void {
        this.settings.triangles = triangles
        // Используем экспортированную функцию компонента
        if (this.component && this.component.updateTriangles) {
            this.component.updateTriangles(triangles)
        }
    }

    updateWorkerStats(stats: any): void {
        this.settings.workerStats = stats
        // Используем экспортированную функцию компонента
        if (this.component && this.component.updateWorkerStats) {
            this.component.updateWorkerStats(stats)
        }
    }

    updateSetting(key: keyof UISettings, value: any): void {
        this.settings[key] = value as never
        if (this.component && this.component.updateSetting) {
            this.component.updateSetting(key, value)
        }
    }

    getSettings(): UISettings {
        return { ...this.settings }
    }

    show(): void {
        // В Svelte 5 нет $set, нужно использовать другой подход
        // Можно экспортировать функцию из компонента для изменения видимости
    }

    hide(): void {
        // В Svelte 5 нет $set, нужно использовать другой подход
    }

    dispose(): void {
        if (this.component && this.component.$destroy) {
            this.component.$destroy()
            this.component = null
        }
        if (this.container) {
            this.container.innerHTML = ''
        }
    }
}

export type { UISettings } from '../types/UISettings'
