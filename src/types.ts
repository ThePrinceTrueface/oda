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
};
