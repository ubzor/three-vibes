export interface ProfileStep {
    name: string
    startTime: number
    endTime?: number
    duration?: number
    subSteps?: ProfileStep[]
}

export class Profiler {
    private steps: ProfileStep[] = []
    private currentStep: ProfileStep | null = null
    private stepStack: ProfileStep[] = []

    startStep(name: string): void {
        const step: ProfileStep = {
            name,
            startTime: performance.now(),
            subSteps: [],
        }

        if (this.currentStep) {
            // Добавляем как подшаг текущего шага
            this.currentStep.subSteps!.push(step)
            this.stepStack.push(this.currentStep)
        } else {
            // Добавляем как основной шаг
            this.steps.push(step)
        }

        this.currentStep = step
    }

    endStep(): void {
        if (this.currentStep) {
            this.currentStep.endTime = performance.now()
            this.currentStep.duration = this.currentStep.endTime - this.currentStep.startTime

            // Возвращаемся к родительскому шагу
            this.currentStep = this.stepStack.pop() || null
        }
    }

    async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
        this.startStep(name)
        try {
            const result = await fn()
            this.endStep()
            return result
        } catch (error) {
            this.endStep()
            throw error
        }
    }

    measure<T>(name: string, fn: () => T): T {
        this.startStep(name)
        try {
            const result = fn()
            this.endStep()
            return result
        } catch (error) {
            this.endStep()
            throw error
        }
    }

    getResults(): ProfileStep[] {
        return this.steps
    }

    printResults(): void {
        console.group('🔍 Performance Profile Results')
        this.steps.forEach(step => this.printStep(step, 0))
        console.groupEnd()
    }

    private printStep(step: ProfileStep, indent: number): void {
        const indentStr = '  '.repeat(indent)
        const duration = step.duration?.toFixed(2) || 'N/A'
        const icon = this.getStepIcon(step.duration || 0)

        console.log(`${indentStr}${icon} ${step.name}: ${duration}ms`)

        if (step.subSteps && step.subSteps.length > 0) {
            step.subSteps.forEach(subStep => this.printStep(subStep, indent + 1))
        }
    }

    private getStepIcon(duration: number): string {
        if (duration < 10) return '🟢'
        if (duration < 50) return '🟡'
        if (duration < 100) return '🟠'
        return '🔴'
    }

    clear(): void {
        this.steps = []
        this.currentStep = null
        this.stepStack = []
    }

    getTotalTime(): number {
        return this.steps.reduce((total, step) => total + (step.duration || 0), 0)
    }

    getSlowestSteps(count: number = 5): ProfileStep[] {
        const allSteps: ProfileStep[] = []

        const collectSteps = (steps: ProfileStep[]) => {
            steps.forEach(step => {
                allSteps.push(step)
                if (step.subSteps) {
                    collectSteps(step.subSteps)
                }
            })
        }

        collectSteps(this.steps)

        return allSteps
            .filter(step => step.duration !== undefined)
            .sort((a, b) => (b.duration || 0) - (a.duration || 0))
            .slice(0, count)
    }
}

// Глобальный экземпляр профайлера
export const globalProfiler = new Profiler()
