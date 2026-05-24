import { OdaQueuedRequest, OdaQueueStore } from "./queue";

/**
 * Built-in queue storage backed by `localStorage`.
 */
export function localStorage(namespace?: string): OdaQueueStore {
  const key = `oda-queue-${namespace ?? Math.random().toString(36).slice(2, 9)}`;
  const storage = window.localStorage;

  return {
    async load(): Promise<OdaQueuedRequest[]> {
      try {
        const raw = storage.getItem(key);
        return raw ? (JSON.parse(raw) as OdaQueuedRequest[]) : [];
      } catch {
        return [];
      }
    },
    async save(queue: OdaQueuedRequest[]): Promise<void> {
      try {
        storage.setItem(key, JSON.stringify(queue));
      } catch {
        console.warn(
          `[oda] Failed to persist queue "${namespace}" to localStorage`,
        );
      }
    },
  };
}
