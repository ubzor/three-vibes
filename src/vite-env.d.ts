/// <reference types="vite/client" />
/// <reference types="svelte" />

// Типы для импорта шейдерных файлов
declare module '*.vert?raw' {
    const content: string
    export default content
}

declare module '*.frag?raw' {
    const content: string
    export default content
}

declare module '*.glsl?raw' {
    const content: string
    export default content
}

declare module '*.ts' {
    const content: any
    export default content
}

declare module '*.svelte' {
    import type { ComponentType, SvelteComponent } from 'svelte'
    const component: ComponentType<SvelteComponent>
    export default component
}
