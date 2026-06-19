import { BodyPayload } from "../types";
import { OdaOfflineDetector } from "./detector";
import { OdaStorage, MemoryStorage } from "./storage";
import { OdaResponse, SyncCallback } from "../response";

/** Serialisable snapshot of a request to be replayed later. */
export type OdaQueuedRequest = {
  id: string;
  method: string;
  url: string;
  body: BodyPayload | undefined;
  headers: Record<string, string>;
  enqueuedAt: number;
};

export type OdaOfflineQueueOptions = {
  /**
   * Storage backend for the offline queue.
   * Defaults to in-memory (lost on page reload).
   */
  storage?: OdaStorage;
  /**
   * Connectivity detector — required.
   */
  detector: OdaOfflineDetector;
  /**
   * Called when replaying a queued request fails after reconnection.
   */
  onError?: (request: OdaQueuedRequest, error: unknown) => void;
  /**
   * Called after a successful flush.
   */
  onSync?: (replayed: number) => void;
};

export class OdaOfflineQueue {
  private readonly storage: OdaStorage;
  private readonly detector: OdaOfflineDetector;
  private readonly onError: OdaOfflineQueueOptions["onError"];
  private readonly onSync: OdaOfflineQueueOptions["onSync"];
  private replaying = false;
  private replayExecutor: ((entry: OdaQueuedRequest) => Promise<OdaResponse<unknown>>) | null = null;

  /** Per-request sync callbacks registered via res.onSync() — in-memory only. */
  private readonly syncRegistry = new Map<string, SyncCallback<unknown>>();

  private static readonly KEY = "queue";

  constructor(options: OdaOfflineQueueOptions) {
    this.storage = options.storage ?? new MemoryStorage();
    this.detector = options.detector;
    this.onError = options.onError;
    this.onSync = options.onSync;

    this.detector.onReconnect(() => this.flush());
    this.flushOnMount();
  }

  isOffline(): boolean { return this.detector.isOffline(); }

  registerSyncCallback(id: string, cb: SyncCallback<unknown>): void {
    this.syncRegistry.set(id, cb);
  }

  setReplayExecutor(fn: (entry: OdaQueuedRequest) => Promise<OdaResponse<unknown>>): void {
    this.replayExecutor = fn;
  }

  private async flushOnMount(): Promise<void> {
    if (this.detector.isOffline()) return;

    const queue = await this.loadQueue();
    if (queue.length === 0) return;

    setTimeout(() => this.flush(), 0);
  }

  private async loadQueue(): Promise<OdaQueuedRequest[]> {
    const raw = await this.storage.get(OdaOfflineQueue.KEY);
    return raw ? (JSON.parse(raw) as OdaQueuedRequest[]) : [];
  }

  private async saveQueue(queue: OdaQueuedRequest[]): Promise<void> {
    await this.storage.set(OdaOfflineQueue.KEY, JSON.stringify(queue));
  }

  async enqueue(
    method: string,
    url: string,
    body: BodyPayload | undefined,
    headers: Record<string, string>,
  ): Promise<string> {
    const queue = await this.loadQueue();
    const entry: OdaQueuedRequest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      method, url, body, headers,
      enqueuedAt: Date.now(),
    };
    queue.push(entry);
    await this.saveQueue(queue);
    return entry.id;
  }

  async flush(): Promise<void> {
    if (this.replaying || !this.replayExecutor) return;
    this.replaying = true;

    try {
      const queue = await this.loadQueue();
      const remaining: OdaQueuedRequest[] = [];

      for (const entry of queue) {
        try {
          const replayedRes = await this.replayExecutor(entry);

          const cb = this.syncRegistry.get(entry.id);
          if (cb) {
            cb(replayedRes);
            this.syncRegistry.delete(entry.id);
          }

        } catch (error) {
          const cb = this.syncRegistry.get(entry.id);
          if (cb) {
            cb(OdaResponse.failure(error as Error, null, null));
            this.syncRegistry.delete(entry.id);
          }

          this.onError?.(entry, error);
          remaining.push(entry);
        }
      }

      await this.saveQueue(remaining);

      const replayed = queue.length - remaining.length;
      if (replayed > 0) {
        this.onSync?.(replayed);
      }
    } finally {
      this.replaying = false;
    }
  }
}
