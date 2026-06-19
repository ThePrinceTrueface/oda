import { OdaHttpError, OdaQueueError, OdaTimeoutError } from "./errors";

export type OdaResponseState<T> =
  | { kind: "success"; data: T; status: number; headers: Headers; stale: boolean }
  | {
      kind: "error";
      error: OdaHttpError | OdaTimeoutError | Error;
      status: number | null;
      headers: Headers | null;
    }
  | {
      kind: "queued";
      reqId: string;
      registerCallback: (id: string, cb: SyncCallback<unknown>) => void;
    };

/** Callback type for res.onSync() — receives the replayed OdaResponse. */
export type SyncCallback<T> = (res: OdaResponse<T>) => void;

/**
 * Wraps every HTTP response in a Result-style container.
 * Never throws — check `isError()` or `isInQueue()` before reading `data()`.
 */
export class OdaResponse<T> {
  private constructor(private readonly state: OdaResponseState<T>) {}

  // ── Static constructors ───────────────────────────────────────────────────

  static success<T>(
    data: T,
    status: number,
    headers: Headers,
    stale = false,
  ): OdaResponse<T> {
    return new OdaResponse<T>({ kind: "success", data, status, headers, stale });
  }

  static failure<T>(
    error: OdaHttpError | OdaTimeoutError | Error,
    status: number | null,
    headers: Headers | null,
  ): OdaResponse<T> {
    return new OdaResponse<T>({ kind: "error", error, status, headers });
  }

  static queued<T>(
    reqId: string,
    registerCallback: (id: string, cb: SyncCallback<unknown>) => void,
  ): OdaResponse<T> {
    return new OdaResponse<T>({ kind: "queued", reqId, registerCallback });
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  /** Returns true when the request completed successfully (2xx). */
  isSuccess(): this is OdaResponse<T> & { state: { kind: "success" } } {
    return this.state.kind === "success";
  }

  /** Returns true when the request failed (non-2xx, timeout, or abort). */
  isError(): boolean {
    return this.state.kind === "error";
  }

  /** Returns true when the request was enqueued due to no connectivity. */
  isInQueue(): boolean {
    return this.state.kind === "queued";
  }

  /**
   * Returns true when the data comes from an expired cache entry used as
   * a fallback after a failed network request (stale-on-error).
   * Always false on fresh responses or errors.
   */
  isStale(): boolean {
    return this.state.kind === "success" && this.state.stale;
  }

  /**
   * Registers a callback to be called when this queued request is replayed
   * after reconnection. The callback receives the full `OdaResponse<T>` of
   * the replayed request — success or error.
   */
  onSync(callback: (res: OdaResponse<T>) => void): this {
    if (this.state.kind !== "queued") return this;
    this.state.registerCallback(
      this.state.reqId,
      callback as SyncCallback<unknown>,
    );
    return this;
  }

  /**
   * Returns the parsed response body.
   */
  data(): T | unknown {
    if (this.state.kind === "queued") {
      throw new OdaQueueError();
    }
    if (this.state.kind === "error") {
      return this.state.error instanceof OdaHttpError
        ? this.state.error.body
        : null;
    }
    return this.state.data;
  }

  error(): OdaHttpError | OdaTimeoutError | Error | null {
    if (this.state.kind === "error") return this.state.error;
    return null;
  }

  status(): number | null {
    if (this.state.kind === "queued") return null;
    return this.state.status;
  }

  headers(): Headers | null {
    if (this.state.kind === "queued") return null;
    return this.state.headers;
  }
}
