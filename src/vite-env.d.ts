/// <reference types="vite/client" />
/// <reference types="svelte" />

declare module '*.ts' {
    const content: any
    export default content
}

declare module '*.svelte' {
    import type { ComponentType, SvelteComponent } from 'svelte'
    const component: ComponentType<SvelteComponent>
    export default component
}
