import { OdaHttpError, OdaQueueError, OdaTimeoutError } from "./errors";

type OdaResponseState<T> =
  | { kind: "success"; data: T; status: number; headers: Headers }
  | {
      kind: "error";
      error: OdaHttpError | OdaTimeoutError | Error;
      status: number | null;
      headers: Headers | null;
    }
  | { kind: "queued" };

/**
 * Wraps every HTTP response in a Result-style container.
 * Never throws — check `isError()` or `isInQueue()` before reading `data()`.
 */
export class OdaResponse<T> {
  private constructor(private readonly state: OdaResponseState<T>) {}

  // ── Static constructors ───────────────────────────────────────────────────

  static success<T>(data: T, status: number, headers: Headers): OdaResponse<T> {
    return new OdaResponse<T>({ kind: "success", data, status, headers });
  }

  static failure<T>(
    error: OdaHttpError | OdaTimeoutError | Error,
    status: number | null,
    headers: Headers | null,
  ): OdaResponse<T> {
    return new OdaResponse<T>({ kind: "error", error, status, headers });
  }

  static queued<T>(): OdaResponse<T> {
    return new OdaResponse<T>({ kind: "queued" });
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
   * Returns the parsed response body.
   * - On success  → T
   * - On error    → the error body if HTTP (may be null), null for timeout/abort
   * - In queue    → throws OdaQueueError (no data exists yet)
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

  /**
   * Returns the error that caused the failure.
   * Returns null if the request succeeded or is queued.
   */
  error(): OdaHttpError | OdaTimeoutError | Error | null {
    if (this.state.kind === "error") return this.state.error;
    return null;
  }

  /**
   * Returns the HTTP status code.
   * Returns null if the request is queued or failed before receiving a response.
   */
  status(): number | null {
    if (this.state.kind === "queued") return null;
    return this.state.status;
  }

  /**
   * Returns the response headers.
   * Returns null if the request is queued or failed before receiving a response.
   */
  headers(): Headers | null {
    if (this.state.kind === "queued") return null;
    return this.state.headers;
  }
}
