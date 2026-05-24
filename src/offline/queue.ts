import { BodyPayload } from "../types";
import { OdaOfflineDetector } from "./detector";

/** Serialisable snapshot of a request to be replayed later. */
export type OdaQueuedRequest = {
  id: string;
  method: string;
  url: string;
  body: BodyPayload | undefined;
  headers: Record<string, string>;
  enqueuedAt: number;
};

/**
 * Pluggable storage backend for the offline queue.
 */
export interface OdaQueueStore {
  load(): Promise<OdaQueuedRequest[]>;
  save(queue: OdaQueuedRequest[]): Promise<void>;
}

export type OdaOfflineQueueOptions = {
  /** Storage backend. Defaults to in-memory. */
  storage?: OdaQueueStore;
  /** Connectivity detector — required. */
  detector: OdaOfflineDetector;
  /** Called when replaying a queued request fails after reconnection. */
  onError?: (request: OdaQueuedRequest, error: unknown) => void;
};

class MemoryQueueStore implements OdaQueueStore {
  private data: OdaQueuedRequest[] = [];
  async load() {
    return [...this.data];
  }
  async save(queue: OdaQueuedRequest[]) {
    this.data = [...queue];
  }
}

export class OdaOfflineQueue {
  private readonly store: OdaQueueStore;
  private readonly detector: OdaOfflineDetector;
  private readonly onError: OdaOfflineQueueOptions["onError"];
  private replaying = false;
  private replayExecutor: ((entry: OdaQueuedRequest) => Promise<void>) | null =
    null;

  constructor(options: OdaOfflineQueueOptions) {
    this.store = options.storage ?? new MemoryQueueStore();
    this.detector = options.detector;
    this.onError = options.onError;
    this.detector.onReconnect(() => this.flush());
  }

  isOffline(): boolean {
    return this.detector.isOffline();
  }

  setReplayExecutor(fn: (entry: OdaQueuedRequest) => Promise<void>): void {
    this.replayExecutor = fn;
  }

  async enqueue(
    method: string,
    url: string,
    body: BodyPayload | undefined,
    headers: Record<string, string>,
  ): Promise<string> {
    const queue = await this.store.load();
    const entry: OdaQueuedRequest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      method,
      url,
      body,
      headers,
      enqueuedAt: Date.now(),
    };
    queue.push(entry);
    await this.store.save(queue);
    return entry.id;
  }

  async flush(): Promise<void> {
    if (this.replaying || !this.replayExecutor) return;
    this.replaying = true;

    try {
      const queue = await this.store.load();
      const remaining: OdaQueuedRequest[] = [];

      for (const entry of queue) {
        try {
          await this.replayExecutor(entry);
        } catch (error) {
          this.onError?.(entry, error);
          remaining.push(entry);
        }
      }

      await this.store.save(remaining);
    } finally {
      this.replaying = false;
    }
  }
}
