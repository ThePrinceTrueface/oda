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
   *
   * @example
   * // Client that may call any domain (e.g. a CDN proxy client)
   * const cdnClient = oda.http.client("https://cdn.example.com", {
   *   scopeCheck: false,
   * });
   */
  scopeCheck?: boolean;
};
