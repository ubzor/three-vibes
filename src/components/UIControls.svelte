<script lang="ts">
  import type { UISettings } from '../types/UISettings'
  import { defaultSettings } from '../types/UISettings'

  // Props
  interface Props {
    visible?: boolean
    onSettingsChange?: ((changes: Partial<UISettings>) => void) | undefined
  }

  let { visible = true, onSettingsChange }: Props = $props()

  // State - используем $state для реактивности
  let settings: UISettings = $state({ ...defaultSettings })

  // Reactive computed values - используем $derived
  let timeString = $derived(getTimeString(settings.timeOfDay))
  let fpsClass = $derived(getFpsClass(settings.fps))
  let formattedTriangles = $derived(settings.triangles.toLocaleString())
  let roundedFPS = $derived(Math.round(settings.fps))

  function getTimeString(timeValue: number): string {
    const hours = Math.floor(timeValue * 24)
    const minutes = Math.floor((timeValue * 24 - hours) * 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  function getFpsClass(fps: number): string {
    const roundedFPS = Math.round(fps)
    if (roundedFPS >= 60) return 'fps-good'
    if (roundedFPS >= 30) return 'fps-medium'
    return 'fps-poor'
  }

  function handleSettingChange(key: keyof UISettings, value: any) {
    settings[key] = value as never
    if (onSettingsChange) {
      onSettingsChange({ [key]: value })
    }
  }

  function setTimePreset(timeValue: number) {
    handleSettingChange('timeOfDay', timeValue)
  }

  // Экспортируем функции для обновления данных извне
  export function updateFPS(fps: number) {
    settings.fps = fps
  }

  export function updateTriangles(triangles: number) {
    settings.triangles = triangles
  }

  export function updateSetting(key: keyof UISettings, value: any) {
    settings[key] = value as never
  }

  export function getSettings(): UISettings {
    return { ...settings }
  }

  // Новая функция для обновления статистики воркеров
  export function updateWorkerStats(stats: any) {
    settings.workerStats = stats
  }
</script>

<div class="ui-controls" class:hidden={!visible}>
  <h3>3D Landscape Controls</h3>
  
  <!-- Performance Section -->
  <div class="control-group performance">
    <h4>Performance:</h4>
    <div class="fps-display">
      <span>FPS:</span>
      <span class="fps-value {fpsClass}">{roundedFPS}</span>
    </div>
    <div class="triangles-display">
      <span>Triangles:</span>
      <span class="triangles-value">{formattedTriangles}</span>
    </div>
  </div>

  <!-- Workers Section -->
  {#if settings.workerStats}
  <div class="control-group workers">
    <h4>Chunk Workers:</h4>
    {#if settings.workerStats.workerPool}
    <div class="worker-stats">
      <div class="stat-row">
        <span>Workers:</span>
        <span class="stat-value">{settings.workerStats.workerPool.totalWorkers}</span>
      </div>
      <div class="stat-row">
        <span>Available:</span>
        <span class="stat-value">{settings.workerStats.workerPool.availableWorkers}</span>
      </div>
      <div class="stat-row">
        <span>Busy:</span>
        <span class="stat-value">{settings.workerStats.workerPool.busyWorkers}</span>
      </div>
      <div class="stat-row">
        <span>Queued:</span>
        <span class="stat-value">{settings.workerStats.workerPool.queuedTasks}</span>
      </div>
    </div>
    {/if}
    {#if settings.workerStats.stateManager}
    <div class="chunk-stats">
      <div class="stat-row">
        <span>Total:</span>
        <span class="stat-value">{settings.workerStats.stateManager.total}</span>
      </div>
      <div class="stat-row">
        <span>Pending:</span>
        <span class="stat-value chunk-pending">{settings.workerStats.stateManager.pending}</span>
      </div>
      <div class="stat-row">
        <span>Generating:</span>
        <span class="stat-value chunk-generating">{settings.workerStats.stateManager.generating}</span>
      </div>
      <div class="stat-row">
        <span>Ready:</span>
        <span class="stat-value chunk-ready">{settings.workerStats.stateManager.ready}</span>
      </div>
      <div class="stat-row">
        <span>Rendered:</span>
        <span class="stat-value chunk-rendered">{settings.workerStats.stateManager.rendered}</span>
      </div>
    </div>
    {/if}
  </div>
  {/if}

  
  <!-- Render Distance -->
  <div class="control-group">
    <div class="control-header">
      <label for="render-distance">Render Distance:</label>
      <span class="control-value">{settings.renderDistance}</span>
    </div>
    <input 
      type="range" 
      id="render-distance" 
      min="3" 
      max="10" 
      step="1" 
      bind:value={settings.renderDistance}
      oninput={() => handleSettingChange('renderDistance', settings.renderDistance)}
    >
  </div>

  <!-- Time of Day -->
  <div class="control-group">
    <div class="control-header">
      <label for="time-of-day">Time of Day:</label>
      <span class="control-value">{timeString}</span>
    </div>
    <input 
      type="range" 
      id="time-of-day" 
      min="0" 
      max="1" 
      step="0.01" 
      bind:value={settings.timeOfDay}
      oninput={() => handleSettingChange('timeOfDay', settings.timeOfDay)}
    >
  </div>

  <!-- Time Presets -->
  <div class="control-group">
    <span>Quick Time Presets:</span>
    <div class="preset-buttons">
      <button class="preset-button" onclick={() => setTimePreset(0.25)}>Dawn</button>
      <button class="preset-button" onclick={() => setTimePreset(0.5)}>Noon</button>
      <button class="preset-button" onclick={() => setTimePreset(0.75)}>Sunset</button>
      <button class="preset-button" onclick={() => setTimePreset(0.0)}>Night</button>
    </div>
  </div>

  <!-- Show Wireframe -->
  <div class="control-group">
    <label>
      <input 
        type="checkbox" 
        bind:checked={settings.showWireframe}
        onchange={() => handleSettingChange('showWireframe', settings.showWireframe)}
      >
      Show Wireframe
    </label>
  </div>

  <!-- Instructions -->
  <div class="control-group instructions">
    <h4>Controls:</h4>
    <small>
      WASD/Arrows - Move<br>
      Q/E - Up/Down<br>
      Right Mouse - Rotate<br>
      Wheel - Zoom<br>
      Shift - Speed Boost
    </small>
  </div>
</div>

<style>
  .ui-controls {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 280px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px;
    border-radius: 8px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    z-index: 1000;
    max-height: 90vh;
    overflow-y: auto;
  }

  .ui-controls.hidden {
    display: none;
  }

  .ui-controls h3 {
    margin: 0 0 15px 0;
    font-size: 16px;
    font-weight: bold;
    text-align: center;
    border-bottom: 1px solid #444;
    padding-bottom: 10px;
  }

  .ui-controls h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
    font-weight: bold;
    color: #ccc;
  }

  .control-group {
    margin-bottom: 15px;
  }

  .control-group.performance {
    background: rgba(255, 255, 255, 0.05);
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 20px;
  }

  .control-group.workers {
    background: rgba(255, 255, 255, 0.05);
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 20px;
  }

  .worker-stats, .chunk-stats {
    margin-bottom: 10px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3px;
    font-size: 12px;
  }

  .stat-value {
    font-weight: bold;
    padding: 1px 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.1);
    color: #90caf9;
    min-width: 20px;
    text-align: center;
  }

  .stat-value.chunk-pending {
    background: rgba(255, 193, 7, 0.3);
    color: #ffb74d;
  }

  .stat-value.chunk-generating {
    background: rgba(33, 150, 243, 0.3);
    color: #64b5f6;
  }

  .stat-value.chunk-ready {
    background: rgba(76, 175, 80, 0.3);
    color: #81c784;
  }

  .stat-value.chunk-rendered {
    background: rgba(156, 39, 176, 0.3);
    color: #ba68c8;
  }

  .fps-display, .triangles-display {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
  }

  .fps-value {
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.1);
  }

  .fps-value.fps-good {
    background: rgba(76, 175, 80, 0.3);
    color: #81c784;
  }

  .fps-value.fps-medium {
    background: rgba(255, 193, 7, 0.3);
    color: #ffb74d;
  }

  .fps-value.fps-poor {
    background: rgba(244, 67, 54, 0.3);
    color: #e57373;
  }

  .triangles-value {
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.1);
    color: #64b5f6;
  }

  label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
  }

  .control-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
  }

  .control-header label {
    margin-bottom: 0;
  }

  .control-value {
    font-weight: bold;
    color: #64b5f6;
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 12px;
  }

  span {
    font-weight: 500;
  }

  input[type="range"] {
    width: 100%;
    margin: 5px 0;
  }

  input[type="checkbox"] {
    margin-right: 8px;
  }

  .preset-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
    margin-top: 5px;
  }

  .preset-button, button {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid #555;
    border-radius: 3px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 12px;
  }

  .preset-button:hover, button:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: #777;
  }

  .preset-button:active, button:active {
    background: rgba(255, 255, 255, 0.3);
  }

  .instructions {
    background: rgba(255, 255, 255, 0.05);
    padding: 10px;
    border-radius: 5px;
    margin-top: 20px;
  }

  .instructions small {
    line-height: 1.4;
    color: #ccc;
  }

  /* Scrollbar styling */
  .ui-controls::-webkit-scrollbar {
    width: 6px;
  }

  .ui-controls::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .ui-controls::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }

  .ui-controls::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
  }
</style>
