import { OdaEngineResponse } from "./engine";
import { OdaScopeError, OdaTimeoutError } from "./errors";
import { OdaClientOptions, QueryParams } from "./types";

export function buildQueryURL(url: string, query: QueryParams): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (v !== null && v !== undefined) {
        searchParams.append(key, String(v));
      }
    }
  }
  const qs = searchParams.toString();
  if (!qs) return url;
  return url.includes("?") ? `${url}&${qs}` : `${url}?${qs}`;
}

export function mergeHeaders(
  base: Record<string, string> | undefined,
  extras: Record<string, string>,
): Record<string, string> {
  return { ...base, ...extras };
}

export async function withTimeout(
  promise: Promise<OdaEngineResponse>,
  ms: number,
  url: string,
): Promise<OdaEngineResponse> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new OdaTimeoutError(url, ms)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timerId);
  }
}

export function resolveURL(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (!base) return path;
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

/**
 * Asserts a resolved URL stays within the client's baseURL scope.
 */
export function assertScope(resolvedURL: string, scope: string): void {
  if (!resolvedURL.startsWith(scope)) {
    throw new OdaScopeError(resolvedURL, scope);
  }
}

export function mergeOptions(
  parent: OdaClientOptions,
  child: OdaClientOptions,
): OdaClientOptions {
  return {
    defaultTimeout: child.defaultTimeout ?? parent.defaultTimeout,
    offlineQueue: child.offlineQueue ?? parent.offlineQueue,
    engine: child.engine ?? parent.engine,
    scopeCheck: child.scopeCheck ?? parent.scopeCheck ?? true,
  };
}
