import { ChunkGenerationResult } from './ChunkWorker'

export enum ChunkState {
    PENDING = 'pending', // Нужно сгенерировать
    GENERATING = 'generating', // В процессе генерации в воркере
    READY = 'ready', // Готов к созданию меша
    RENDERED = 'rendered', // Отрендерен и добавлен в сцену
    REMOVING = 'removing', // В процессе удаления
}

export interface ChunkInfo {
    key: string
    x: number
    z: number
    state: ChunkState
    generationId?: string
    geometryData?: ChunkGenerationResult
    priority: number
    lastAccessed: number
}

export class ChunkStateManager {
    private chunks: Map<string, ChunkInfo> = new Map()
    private pendingChunks: Set<string> = new Set()
    private generatingChunks: Map<string, string> = new Map() // chunkKey -> generationId
    private readyChunks: Set<string> = new Set()
    private renderedChunks: Set<string> = new Set()

    // Приоритеты для генерации
    private centerX = 0
    private centerZ = 0
    private renderRadius = 6 // Будет обновляться из TerrainGenerator

    constructor() {
        // Периодически очищаем старые данные
        setInterval(() => this.cleanup(), 30000) // каждые 30 секунд
    }

    updateCenter(x: number, z: number): void {
        this.centerX = x
        this.centerZ = z
        this.updatePriorities()
        this.cleanupOutOfRangeChunks() // Очищаем чанки вне радиуса видимости
    }

    addChunk(x: number, z: number, state: ChunkState = ChunkState.PENDING): void {
        const key = this.getChunkKey(x, z)

        if (this.chunks.has(key)) {
            return // чанк уже существует
        }

        const priority = this.calculatePriority(x, z)
        const chunkInfo: ChunkInfo = {
            key,
            x,
            z,
            state,
            priority,
            lastAccessed: Date.now(),
        }

        this.chunks.set(key, chunkInfo)
        this.updateChunkStateSet(key, ChunkState.PENDING, state)
    }

    setChunkState(x: number, z: number, newState: ChunkState, data?: any): void {
        const key = this.getChunkKey(x, z)
        const chunk = this.chunks.get(key)

        if (!chunk) {
            console.warn(`⚠️ Tried to set state for non-existent chunk ${key}`)
            return
        }

        const oldState = chunk.state
        chunk.state = newState
        chunk.lastAccessed = Date.now()

        // Обновляем специальные данные
        if (newState === ChunkState.GENERATING && typeof data === 'string') {
            chunk.generationId = data
            this.generatingChunks.set(key, data)
        } else if (newState === ChunkState.READY && data) {
            chunk.geometryData = data
        }

        // Обновляем наборы состояний
        this.updateChunkStateSet(key, oldState, newState)
    }

    getChunkState(x: number, z: number): ChunkState | null {
        const key = this.getChunkKey(x, z)
        return this.chunks.get(key)?.state || null
    }

    getChunkInfo(x: number, z: number): ChunkInfo | null {
        const key = this.getChunkKey(x, z)
        return this.chunks.get(key) || null
    }

    removeChunk(x: number, z: number): void {
        const key = this.getChunkKey(x, z)
        const chunk = this.chunks.get(key)

        if (!chunk) return

        // Удаляем из всех наборов состояний
        this.updateChunkStateSet(key, chunk.state, null)
        this.chunks.delete(key)
    }

    // Получение чанков по состояниям
    getPendingChunks(): ChunkInfo[] {
        return Array.from(this.pendingChunks)
            .map(key => this.chunks.get(key)!)
            .filter(chunk => chunk)
            .sort((a, b) => b.priority - a.priority) // Сортируем по приоритету
    }

    getGeneratingChunks(): ChunkInfo[] {
        return Array.from(this.generatingChunks.keys())
            .map(key => this.chunks.get(key)!)
            .filter(chunk => chunk)
    }

    getReadyChunks(): ChunkInfo[] {
        return Array.from(this.readyChunks)
            .map(key => this.chunks.get(key)!)
            .filter(chunk => chunk)
            .sort((a, b) => b.priority - a.priority)
    }

    getRenderedChunks(): ChunkInfo[] {
        return Array.from(this.renderedChunks)
            .map(key => this.chunks.get(key)!)
            .filter(chunk => chunk)
    }

    // Проверка состояний
    isChunkInState(x: number, z: number, state: ChunkState): boolean {
        return this.getChunkState(x, z) === state
    }

    isChunkGenerating(x: number, z: number): boolean {
        const key = this.getChunkKey(x, z)
        return this.generatingChunks.has(key)
    }

    getGenerationId(x: number, z: number): string | null {
        const key = this.getChunkKey(x, z)
        return this.generatingChunks.get(key) || null
    }

    // Поиск чанка по ID генерации
    findChunkByGenerationId(generationId: string): ChunkInfo | null {
        for (const [key, id] of this.generatingChunks) {
            if (id === generationId) {
                return this.chunks.get(key) || null
            }
        }
        return null
    }

    // Статистика
    getStats(): {
        total: number
        pending: number
        generating: number
        ready: number
        rendered: number
        removing: number
    } {
        return {
            total: this.chunks.size,
            pending: this.pendingChunks.size,
            generating: this.generatingChunks.size,
            ready: this.readyChunks.size,
            rendered: this.renderedChunks.size,
            removing: Array.from(this.chunks.values()).filter(c => c.state === ChunkState.REMOVING).length,
        }
    }

    private cancelGeneratingChunk(x: number, z: number): void {
        const key = this.getChunkKey(x, z)
        const chunk = this.chunks.get(key)

        if (chunk && chunk.state === ChunkState.GENERATING) {
            // Помечаем чанк как отмененный, воркер сможет проверить это
            chunk.state = ChunkState.REMOVING
            this.generatingChunks.delete(key)
        }
    }

    private updateChunkStateSet(key: string, oldState: ChunkState | null, newState: ChunkState | null): void {
        // Удаляем из старого набора
        if (oldState) {
            switch (oldState) {
                case ChunkState.PENDING:
                    this.pendingChunks.delete(key)
                    break
                case ChunkState.GENERATING:
                    this.generatingChunks.delete(key)
                    break
                case ChunkState.READY:
                    this.readyChunks.delete(key)
                    break
                case ChunkState.RENDERED:
                    this.renderedChunks.delete(key)
                    break
            }
        }

        // Добавляем в новый набор
        if (newState) {
            switch (newState) {
                case ChunkState.PENDING:
                    this.pendingChunks.add(key)
                    break
                case ChunkState.GENERATING:
                    // generationId добавляется отдельно
                    break
                case ChunkState.READY:
                    this.readyChunks.add(key)
                    break
                case ChunkState.RENDERED:
                    this.renderedChunks.add(key)
                    break
            }
        }
    }

    private getChunkKey(x: number, z: number): string {
        return `${x},${z}`
    }

    private calculatePriority(x: number, z: number): number {
        const dx = x - this.centerX
        const dz = z - this.centerZ
        const distance = Math.sqrt(dx * dx + dz * dz)

        // Чем ближе к центру, тем выше приоритет
        return Math.max(0, 1000 - distance * 10)
    }

    private updatePriorities(): void {
        // Обновляем приоритеты всех чанков на основе новой позиции центра
        for (const chunk of this.chunks.values()) {
            chunk.priority = this.calculatePriority(chunk.x, chunk.z)
        }
    }

    private cleanupOutOfRangeChunks(): void {
        const chunksToRemove: string[] = []
        const maxDistance = this.renderRadius + 1 // Небольшой буфер для плавного удаления

        for (const chunk of this.chunks.values()) {
            const dx = chunk.x - this.centerX
            const dz = chunk.z - this.centerZ
            const distance = Math.sqrt(dx * dx + dz * dz)

            if (distance > maxDistance) {
                // Чанк слишком далеко - удаляем его
                if (chunk.state === ChunkState.GENERATING) {
                    // Отменяем генерацию для воркера
                    this.cancelGeneratingChunk(chunk.x, chunk.z)
                }

                chunksToRemove.push(chunk.key)
            }
        }

        // Удаляем чанки вне радиуса
        for (const key of chunksToRemove) {
            const chunk = this.chunks.get(key)
            if (chunk) {
                this.updateChunkStateSet(key, chunk.state, null)
                this.chunks.delete(key)
            }
        }
    }

    private cleanup(): void {
        // Удаляем старые неактивные чанки (старше 5 минут)
        const now = Date.now()
        const maxAge = 5 * 60 * 1000 // 5 минут
        const chunksToRemove: string[] = []

        for (const chunk of this.chunks.values()) {
            if (now - chunk.lastAccessed > maxAge && chunk.state !== ChunkState.RENDERED) {
                chunksToRemove.push(chunk.key)
            }
        }

        for (const key of chunksToRemove) {
            const chunk = this.chunks.get(key)
            if (chunk) {
                this.updateChunkStateSet(key, chunk.state, null)
                this.chunks.delete(key)
            }
        }

        if (chunksToRemove.length > 0) {
            console.log(`🧹 Cleaned up ${chunksToRemove.length} old inactive chunks`)
        }
    }

    // Публичный метод для установки радиуса рендеринга
    setRenderRadius(radius: number): void {
        this.renderRadius = radius
        this.cleanupOutOfRangeChunks()
    }

    getRenderRadius(): number {
        return this.renderRadius
    }
}
