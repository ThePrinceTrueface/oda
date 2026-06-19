/**
 * Pluggable connectivity detector.
 */
export interface OdaOfflineDetector {
  /** Returns true when the app has no connectivity. */
  isOffline(): boolean;
  /**
   * Registers a callback invoked when connectivity is restored.
   */
  onReconnect(callback: () => void): void;
}

/**
 * Built-in detector factory for browser and Tauri environments.
 */
export function browserOfflineDetector(): OdaOfflineDetector {
  return {
    isOffline: () => !navigator.onLine,
    onReconnect: (cb) => window.addEventListener("online", cb),
  };
}
