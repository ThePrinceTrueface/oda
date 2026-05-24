import { OdaHttpClient } from "./client";
import { OdaEngine, setGlobalEngine } from "./engine";
import { browserOfflineDetector } from "./offline/detector";
import { localStorage } from "./offline/storage";
import { OdaClientOptions } from "./types";

// Re-export all public types and classes
export * from "./client";
export * from "./engine";
export * from "./errors";
export * from "./offline/detector";
export * from "./offline/queue";
export * from "./offline/storage";
export * from "./response";
export * from "./types";

/**
 * HTTP client factory.
 */
const http = {
  client(baseURL: string, options?: OdaClientOptions): OdaHttpClient {
    return new OdaHttpClient(baseURL, options);
  },
};

/**
 * Built-in helpers for common runtime environments.
 */
const helper = {
  localStorage,
  browserOfflineDetector,
};

/**
 * ODA Namespace
 */
const oda = {
  http,
  helper,
  /**
   * Sets the global HTTP engine used by all clients that don't define their own.
   */
  setEngine(engine: OdaEngine): void {
    setGlobalEngine(engine);
  },
};

export default oda;
