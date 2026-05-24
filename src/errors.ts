/** Thrown when a request exceeds its configured timeout. */
export class OdaTimeoutError extends Error {
  constructor(
    public readonly url: string,
    public readonly ms: number,
  ) {
    super(`Request timed out after ${ms}ms — ${url}`);
    this.name = "OdaTimeoutError";
  }
}

/** Thrown when the server responds with a non-2xx status. */
export class OdaHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: unknown,
    public readonly url: string,
  ) {
    super(`HTTP ${status} ${statusText} — ${url}`);
    this.name = "OdaHttpError";
  }
}

/** Thrown when .data() is called on a queued response. */
export class OdaQueueError extends Error {
  constructor() {
    super("No data available — request is in the offline queue.");
    this.name = "OdaQueueError";
  }
}
