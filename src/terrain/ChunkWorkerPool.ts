import { ChunkGenerationRequest, ChunkGenerationResult } from './ChunkWorker'

export interface WorkerPoolConfig {
    maxWorkers: number
    workerScript: string
}

export class ChunkWorkerPool {
    private workers: Worker[] = []
    private availableWorkers: Worker[] = []
    private busyWorkers: Set<Worker> = new Set()
    private taskQueue: Array<{
        request: ChunkGenerationRequest
        resolve: (result: ChunkGenerationResult) => void
        reject: (error: Error) => void
    }> = []
    private maxWorkers: number
    private workerScript: string

    constructor(config: WorkerPoolConfig) {
        this.maxWorkers = config.maxWorkers
        this.workerScript = config.workerScript
    }

    async initialize(): Promise<void> {
        // Проверяем поддержку Web Workers
        if (typeof Worker === 'undefined') {
            throw new Error('Web Workers not supported in this environment')
        }

        console.log(`🔧 Creating ${this.maxWorkers} workers...`)

        // Создаем пул воркеров
        for (let i = 0; i < this.maxWorkers; i++) {
            try {
                const worker = this.createWorker()
                this.workers.push(worker)
                this.availableWorkers.push(worker)
                console.log(`✅ Worker ${i + 1}/${this.maxWorkers} created`)
            } catch (error) {
                console.error(`❌ Failed to create worker ${i + 1}:`, error)
                throw error
            }
        }

        console.log(`🔧 Initialized chunk worker pool with ${this.maxWorkers} workers`)
    }

    private createWorker(): Worker {
        try {
            console.log('🔄 Creating worker with script:', this.workerScript)
            const worker = new Worker(new URL('./ChunkWorker.ts', import.meta.url), {
                type: 'module',
            })

            worker.onmessage = (e: MessageEvent<ChunkGenerationResult>) => {
                this.handleWorkerMessage(worker, e.data)
            }

            worker.onerror = error => {
                console.error('❌ Worker error:', error)
                this.handleWorkerError(worker, error)
            }

            worker.onmessageerror = error => {
                console.error('❌ Worker message error:', error)
            }

            console.log('✅ Worker created successfully')
            return worker
        } catch (error) {
            console.error('❌ Failed to create worker:', error)
            throw error
        }
    }

    private handleWorkerMessage(worker: Worker, result: ChunkGenerationResult): void {
        // Освобождаем воркер
        this.busyWorkers.delete(worker)
        this.availableWorkers.push(worker)

        // Находим соответствующую задачу и разрешаем промис
        const taskIndex = this.taskQueue.findIndex(task => task.request.id === result.id)

        if (taskIndex !== -1) {
            const task = this.taskQueue.splice(taskIndex, 1)[0]

            if (result.success) {
                task.resolve(result)
            } else {
                task.reject(new Error(result.error || 'Chunk generation failed'))
            }
        }

        // Обрабатываем следующую задачу в очереди
        this.processNextTask()
    }

    private handleWorkerError(worker: Worker, error: ErrorEvent): void {
        console.error('Worker error:', error)

        // Удаляем проблемный воркер из пула
        this.busyWorkers.delete(worker)
        const availableIndex = this.availableWorkers.indexOf(worker)
        if (availableIndex !== -1) {
            this.availableWorkers.splice(availableIndex, 1)
        }

        const workerIndex = this.workers.indexOf(worker)
        if (workerIndex !== -1) {
            this.workers.splice(workerIndex, 1)
        }

        // Создаем новый воркер взамен
        const newWorker = this.createWorker()
        this.workers.push(newWorker)
        this.availableWorkers.push(newWorker)

        // Отклоняем все задачи, связанные с проблемным воркером
        this.taskQueue.forEach(task => {
            task.reject(new Error('Worker failed'))
        })
        this.taskQueue.length = 0
    }

    async generateChunk(request: ChunkGenerationRequest): Promise<ChunkGenerationResult> {
        return new Promise((resolve, reject) => {
            this.taskQueue.push({ request, resolve, reject })
            this.processNextTask()
        })
    }

    private processNextTask(): void {
        if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
            return
        }

        const worker = this.availableWorkers.pop()!
        const task = this.taskQueue.find(
            t => !this.busyWorkers.has(worker) // Убеждаемся что воркер не занят
        )

        if (!task || !worker) return

        this.busyWorkers.add(worker)

        // Отправляем задачу воркеру
        worker.postMessage(task.request)
    }

    cancelTask(generationId: string): boolean {
        // Ищем задачу в очереди по ID
        const taskIndex = this.taskQueue.findIndex(task => task.request.id === generationId)

        if (taskIndex !== -1) {
            const task = this.taskQueue.splice(taskIndex, 1)[0]
            task.reject(new Error(`Task ${generationId} was cancelled`))
            console.log(`❌ Cancelled queued task ${generationId}`)
            return true
        }

        console.log(`⚠️ Task ${generationId} not found in queue (may already be processing)`)
        return false
    }

    cancelOutOfRangeTasks(centerX: number, centerZ: number, maxDistance: number): number {
        let cancelledCount = 0
        const tasksToCancel: number[] = []

        // Проверяем все задачи в очереди
        for (let i = 0; i < this.taskQueue.length; i++) {
            const task = this.taskQueue[i]
            const dx = task.request.chunkX - centerX
            const dz = task.request.chunkZ - centerZ
            const distance = Math.sqrt(dx * dx + dz * dz)

            if (distance > maxDistance) {
                tasksToCancel.push(i)
            }
        }

        // Удаляем задачи в обратном порядке чтобы не сбить индексы
        for (let i = tasksToCancel.length - 1; i >= 0; i--) {
            const taskIndex = tasksToCancel[i]
            const task = this.taskQueue.splice(taskIndex, 1)[0]
            task.reject(
                new Error(`Task for chunk (${task.request.chunkX}, ${task.request.chunkZ}) cancelled - out of range`)
            )
            cancelledCount++
        }

        // Логируем только если отменили много задач
        if (cancelledCount > 5) {
            console.log(`❌ Cancelled ${cancelledCount} out-of-range tasks from worker queue`)
        }

        return cancelledCount
    }

    getStats(): {
        totalWorkers: number
        availableWorkers: number
        busyWorkers: number
        queuedTasks: number
    } {
        return {
            totalWorkers: this.workers.length,
            availableWorkers: this.availableWorkers.length,
            busyWorkers: this.busyWorkers.size,
            queuedTasks: this.taskQueue.length,
        }
    }

    dispose(): void {
        // Завершаем все воркеры
        this.workers.forEach(worker => {
            worker.terminate()
        })

        this.workers.length = 0
        this.availableWorkers.length = 0
        this.busyWorkers.clear()

        // Отклоняем все оставшиеся задачи
        this.taskQueue.forEach(task => {
            task.reject(new Error('Worker pool disposed'))
        })
        this.taskQueue.length = 0

        console.log('🗑️ Chunk worker pool disposed')
    }
}
