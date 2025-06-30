import { PerspectiveCamera, Vector3, Spherical, Vector2, MathUtils } from 'three'

interface CameraSettings {
    moveSpeed: number
    rotateSpeed: number
    zoomSpeed: number
    minDistance: number
    maxDistance: number
    minPolarAngle: number
    maxPolarAngle: number
}

export class CameraController {
    private camera: PerspectiveCamera
    private target: Vector3
    private spherical: Spherical
    private settings: CameraSettings
    private domElement: HTMLElement | null = null

    // Input state
    private keys: { [key: string]: boolean } = {}
    private mouseButtons: { [button: number]: boolean } = {}
    private lastMousePosition: Vector2 = new Vector2()
    private mouseDelta: Vector2 = new Vector2()

    // Movement state
    private velocity: Vector3 = new Vector3()

    constructor(camera: PerspectiveCamera) {
        this.camera = camera
        this.target = new Vector3(0, 0, 0)
        this.spherical = new Spherical(50, Math.PI / 3, 0)

        this.settings = {
            moveSpeed: 20,
            rotateSpeed: 1,
            zoomSpeed: 2,
            minDistance: 5,
            maxDistance: 200,
            minPolarAngle: 0.1,
            maxPolarAngle: Math.PI - 0.1,
        }

        this.setupInitialPosition()
    }

    init(domElement: HTMLElement): void {
        this.domElement = domElement
        this.addEventListeners()
    }

    private setupInitialPosition(): void {
        // Set initial isometric-style position
        this.target.set(0, 0, 0)
        this.spherical.radius = 80
        this.spherical.theta = Math.PI / 4 // 45 degrees
        this.spherical.phi = Math.PI / 3 // 60 degrees from top
        this.updateCameraPosition()

        // Ensure camera is looking at target
        this.camera.lookAt(this.target)
    }

    private addEventListeners(): void {
        if (!this.domElement) return

        // Keyboard events
        document.addEventListener('keydown', this.onKeyDown.bind(this))
        document.addEventListener('keyup', this.onKeyUp.bind(this))

        // Mouse events
        this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this))
        this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this))
        this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this))
        this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this))

        // Prevent context menu
        this.domElement.addEventListener('contextmenu', e => e.preventDefault())
    }

    private onKeyDown(event: KeyboardEvent): void {
        this.keys[event.code] = true
    }

    private onKeyUp(event: KeyboardEvent): void {
        this.keys[event.code] = false
    }

    private onMouseDown(event: MouseEvent): void {
        this.mouseButtons[event.button] = true
        this.lastMousePosition.set(event.clientX, event.clientY)
    }

    private onMouseMove(event: MouseEvent): void {
        const currentMouse = new Vector2(event.clientX, event.clientY)
        this.mouseDelta.subVectors(currentMouse, this.lastMousePosition)
        this.lastMousePosition.copy(currentMouse)
    }

    private onMouseUp(event: MouseEvent): void {
        this.mouseButtons[event.button] = false
    }

    private onMouseWheel(event: WheelEvent): void {
        event.preventDefault()

        const zoomDelta = event.deltaY * this.settings.zoomSpeed * 0.01
        this.spherical.radius = MathUtils.clamp(
            this.spherical.radius + zoomDelta,
            this.settings.minDistance,
            this.settings.maxDistance
        )
    }

    update(): void {
        this.handleKeyboardInput()
        this.handleMouseInput()
        this.updateCameraPosition()
        this.applyVelocity()
    }

    private handleKeyboardInput(): void {
        const moveVector = new Vector3()

        // Movement keys
        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            moveVector.z -= 1
        }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            moveVector.z += 1
        }
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            moveVector.x -= 1
        }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            moveVector.x += 1
        }
        if (this.keys['KeyQ'] || this.keys['PageUp']) {
            moveVector.y += 1
        }
        if (this.keys['KeyE'] || this.keys['PageDown']) {
            moveVector.y -= 1
        }

        // Apply movement relative to camera direction
        if (moveVector.length() > 0) {
            moveVector.normalize()

            // Get camera's forward and right vectors
            const cameraDirection = new Vector3()
            this.camera.getWorldDirection(cameraDirection)
            cameraDirection.y = 0
            cameraDirection.normalize()

            const cameraRight = new Vector3()
            cameraRight.crossVectors(cameraDirection, new Vector3(0, 1, 0))

            // Apply movement
            const movement = new Vector3()
            movement.addScaledVector(cameraDirection, -moveVector.z)
            movement.addScaledVector(cameraRight, moveVector.x)
            movement.y = moveVector.y

            movement.multiplyScalar(this.settings.moveSpeed * 0.1)
            this.target.add(movement)
        }

        // Speed adjustment
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
            this.settings.moveSpeed = 40 // Fast mode
        } else {
            this.settings.moveSpeed = 20 // Normal speed
        }
    }

    private handleMouseInput(): void {
        // Right mouse button - rotate camera
        if (this.mouseButtons[2]) {
            const rotateSpeed = this.settings.rotateSpeed * 0.01

            this.spherical.theta -= this.mouseDelta.x * rotateSpeed
            this.spherical.phi += this.mouseDelta.y * rotateSpeed

            this.spherical.phi = MathUtils.clamp(
                this.spherical.phi,
                this.settings.minPolarAngle,
                this.settings.maxPolarAngle
            )
        }

        // Middle mouse button - pan
        if (this.mouseButtons[1]) {
            const panSpeed = 0.02
            const panVector = new Vector3()

            // Get camera's right and up vectors
            const cameraRight = new Vector3()
            cameraRight.setFromMatrixColumn(this.camera.matrix, 0)

            const cameraUp = new Vector3()
            cameraUp.setFromMatrixColumn(this.camera.matrix, 1)

            panVector.addScaledVector(cameraRight, -this.mouseDelta.x * panSpeed)
            panVector.addScaledVector(cameraUp, this.mouseDelta.y * panSpeed)

            this.target.add(panVector)
        }

        // Reset mouse delta
        this.mouseDelta.set(0, 0)
    }

    private updateCameraPosition(): void {
        const position = new Vector3()
        position.setFromSpherical(this.spherical)
        position.add(this.target)

        this.camera.position.copy(position)
        this.camera.lookAt(this.target)
    }

    private applyVelocity(): void {
        // Apply damping
        this.velocity.multiplyScalar(0.9)

        // Apply velocity to target
        this.target.add(this.velocity)
    }

    getControlsInfo(): string {
        return `
Controls:
WASD / Arrow Keys - Move
Q/E or PageUp/PageDown - Up/Down
Right Mouse - Rotate camera
Middle Mouse - Pan camera
Mouse Wheel - Zoom
Shift - Speed boost
    `.trim()
    }

    dispose(): void {
        if (!this.domElement) return

        document.removeEventListener('keydown', this.onKeyDown.bind(this))
        document.removeEventListener('keyup', this.onKeyUp.bind(this))
        this.domElement.removeEventListener('mousedown', this.onMouseDown.bind(this))
        this.domElement.removeEventListener('mousemove', this.onMouseMove.bind(this))
        this.domElement.removeEventListener('mouseup', this.onMouseUp.bind(this))
        this.domElement.removeEventListener('wheel', this.onMouseWheel.bind(this))
    }
}
