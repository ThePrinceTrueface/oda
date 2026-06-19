export type BodyPayload = Exclude<unknown, undefined>;

export type QueryParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryParamValue | QueryParamValue[]>;

/** Per-request auth options. */
export type OdaAuth = {
  jwt?: string;
};

/** Per-request config options. */
export type OdaConfig = {
  /** Timeout in ms. Overrides the client-level default. 0 = disabled. */
  timeout?: number;
  /** When true, queues the request if offline and replays at reconnection. */
  offline?: boolean;
  /** AbortSignal to cancel the request manually. */
  signal?: AbortSignal | null;
  /**
   * When true, allows the request to target a URL outside the client's baseURL scope.
   * Use sparingly — prefer a dedicated client for out-of-scope domains.
   * Every usage is intentional and grep-able: `bypassScope: true`.
   *
   * @example
   * // Uploading to a signed S3 URL returned by the API
   * apiClient.post(uploadUrl, { body: file }, { config: { bypassScope: true } });
   */
  bypassScope?: boolean;
  /**
   * When true, skips the cache read for this request — a fresh network call is
   * always made regardless of TTL. The response is still written to the cache
   * afterward if the client has caching enabled.
   */
  bypassCache?: boolean;
};

/** Options accepted by every HTTP method. */
export type OdaRequestOptions = {
  auth?: OdaAuth;
  config?: OdaConfig;
  query?: QueryParams;
  headers?: Record<string, string>;
};

/** Options accepted by methods that send a body (POST, PUT, PATCH). */
export type OdaBodyRequestOptions = OdaRequestOptions & {
  body?: BodyPayload;
};

export type OdaCacheOptions = {
  /**
   * Time-to-live in milliseconds.
   * After expiry, a fresh fetch is triggered. If the fetch fails, the stale
   * entry is returned as a fallback with `res.isStale() === true`.
   */
  ttl: number;
  /**
   * Storage backend for cached responses.
   * Defaults to in-memory (cleared on page reload).
   */
  storage?: import("./offline/storage").OdaStorage;
  /**
   * Custom cache key resolver.
   * Receives the engine request and returns a string key.
   * Defaults to the full request URL.
   */
  key?: (req: import("./engine").OdaEngineRequest) => string;
};

/** Client-level configuration. */
export type OdaClientOptions = {
  defaultTimeout?: number;
  offlineQueue?: import("./offline/queue").OdaOfflineQueueOptions;
  /**
   * HTTP engine used to execute requests.
   * Defaults to the global engine (fetch-based).
   * Override per-client to target a specific runtime (Node, Bun, Deno…).
   */
  engine?: import("./engine").OdaEngine;
  /**
   * When false, disables scope enforcement for all requests on this client.
   * Defaults to true — all requests must stay within the client's baseURL.
   */
  scopeCheck?: boolean;
  /**
   * Response cache for GET requests.
   */
  cache?: OdaCacheOptions;
};
