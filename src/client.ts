import { getGlobalEngine, OdaEngine, OdaEngineRequest, OdaEngineResponse } from "./engine";
import { OdaHttpError, OdaTimeoutError } from "./errors";
import { assertScope, buildQueryURL, mergeHeaders, mergeOptions, resolveURL, withTimeout } from "./helpers";
import { OdaOfflineQueue } from "./offline/queue";
import { MemoryStorage, OdaStorage } from "./offline/storage";
import { OdaResponse, SyncCallback } from "./response";
import { BodyPayload, OdaBodyRequestOptions, OdaCacheOptions, OdaClientOptions, OdaRequestOptions } from "./types";

type OdaCacheEntry = {
  data: unknown;
  status: number;
  headers: Record<string, string>;
  cachedAt: number;
  ttl: number;
};

class OdaCache {
  private readonly storage: OdaStorage;
  private readonly ttl: number;
  private readonly keyResolver: (req: OdaEngineRequest) => string;

  constructor(options: OdaCacheOptions) {
    this.storage = options.storage ?? new MemoryStorage();
    this.ttl = options.ttl;
    this.keyResolver = options.key ?? ((req) => req.url);
  }

  resolveKey(request: OdaEngineRequest): string {
    return this.keyResolver(request);
  }

  async get(key: string): Promise<{ entry: OdaCacheEntry; fresh: boolean } | null> {
    const raw = await this.storage.get(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as OdaCacheEntry;
    const fresh = Date.now() - entry.cachedAt < entry.ttl;
    return { entry, fresh };
  }

  async set(key: string, data: unknown, status: number, headers: Record<string, string>): Promise<void> {
    const entry: OdaCacheEntry = { data, status, headers, cachedAt: Date.now(), ttl: this.ttl };
    await this.storage.set(key, JSON.stringify(entry));
  }

  async invalidate(pattern?: string): Promise<void> {
    if (!pattern) {
      await this.storage.clear();
      return;
    }
    const regex = new RegExp(
      "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^?#]*") + "$",
    );
    
    // Fallback: if storage doesn't support keys(), we just clear all for safety
    // or we skip if delete is too expensive. Here we clear.
    await this.storage.clear();
  }
}

export class OdaHttpClient {
  private readonly baseURL: string;
  private readonly options: OdaClientOptions;
  private readonly queue: OdaOfflineQueue | null;
  private readonly _cache: OdaCache | null;
  private readonly engine: OdaEngine;

  constructor(baseURL: string, options: OdaClientOptions = {}) {
    this.baseURL = baseURL.replace(/\/$/, "");
    this.options = options;
    this.engine = options.engine ?? getGlobalEngine();
    this.queue = options.offlineQueue
      ? new OdaOfflineQueue(options.offlineQueue)
      : null;
    this._cache = options.cache ? new OdaCache(options.cache) : null;

    if (this.queue) {
      this.queue.setReplayExecutor((entry) =>
        this.execute(entry.method, entry.url, entry.body, {
          headers: entry.headers,
        }) as Promise<OdaResponse<unknown>>,
      );
    }
  }

  /**
   * Cache management for this client.
   */
  get cache(): {
    invalidate(pattern?: string): Promise<void>;
    clear(): Promise<void>;
  } {
    if (!this._cache) {
      throw new Error(
        "[oda] client.cache is not available — configure a `cache` option when creating the client.",
      );
    }
    return {
      invalidate: (pattern) => this._cache!.invalidate(pattern),
      clear: () => this._cache!.invalidate(),
    };
  }

  derivate(path: string, options: OdaClientOptions = {}): OdaHttpClient {
    const mergedOptions = mergeOptions(this.options, options);
    const derivedURL = resolveURL(this.baseURL, path);
    return new OdaHttpClient(derivedURL, mergedOptions);
  }

  private async dispatch(
    method: string,
    path: string,
    body: BodyPayload | undefined,
    opts: OdaRequestOptions = {},
  ): Promise<OdaEngineResponse> {
    const { auth, config = {}, query, headers: callerHeaders } = opts;

    const extraHeaders: Record<string, string> = {};
    if (auth?.jwt) extraHeaders["Authorization"] = `Bearer ${auth.jwt}`;

    let resolvedBody: BodyInit | null | undefined;
    if (body !== undefined) {
      if (
        body !== null &&
        typeof body === "object" &&
        !(body instanceof Blob) &&
        !(body instanceof FormData)
      ) {
        resolvedBody = JSON.stringify(body);
        extraHeaders["content-type"] = "application/json";
      } else {
        resolvedBody = body as BodyInit | null;
      }
    }

    const finalHeaders = mergeHeaders(callerHeaders, extraHeaders);
    const fullURL = query
      ? buildQueryURL(resolveURL(this.baseURL, path), query)
      : resolveURL(this.baseURL, path);

    const scopeEnabled = this.options.scopeCheck ?? true;
    if (scopeEnabled && !config.bypassScope) {
      assertScope(fullURL, this.baseURL);
    }

    const effectiveTimeout =
      config.timeout !== undefined
        ? config.timeout
        : (this.options.defaultTimeout ?? 0);

    const controller = new AbortController();
    if (config.signal) {
      config.signal.addEventListener("abort", () =>
        controller.abort(config.signal!.reason),
      );
    }

    const engineRequest: OdaEngineRequest = {
      url: fullURL,
      method,
      headers: finalHeaders,
      signal: controller.signal,
      ...(resolvedBody !== undefined ? { body: resolvedBody } : {}),
    };

    const enginePromise = this.engine.execute(engineRequest);

    return effectiveTimeout > 0
      ? withTimeout(enginePromise, effectiveTimeout, fullURL)
      : enginePromise;
  }

  private async execute<T>(
    method: string,
    path: string,
    body: BodyPayload | undefined,
    opts: OdaRequestOptions = {},
  ): Promise<OdaResponse<T>> {
    // Offline queue
    if (opts.config?.offline && this.queue && this.queue.isOffline()) {
      const headers: Record<string, string> = {};
      if (opts.auth?.jwt) headers["Authorization"] = `Bearer ${opts.auth.jwt}`;
      const reqId = await this.queue.enqueue(
        method,
        resolveURL(this.baseURL, path),
        body,
        headers,
      );
      return OdaResponse.queued<T>(
        reqId,
        (id, cb) => this.queue!.registerSyncCallback(id, cb),
      );
    }

    // Cache — GET requests only
    const isGet = method === "GET";
    let cacheKey: string | null = null;
    let staleEntry: OdaCacheEntry | null = null;

    if (isGet && this._cache) {
      const previewURL = opts.query
        ? buildQueryURL(resolveURL(this.baseURL, path), opts.query)
        : resolveURL(this.baseURL, path);
      const previewReq: OdaEngineRequest = { url: previewURL, method, headers: {} };
      cacheKey = this._cache.resolveKey(previewReq);

      if (!opts.config?.bypassCache) {
        const cached = await this._cache.get(cacheKey);
        if (cached) {
          if (cached.fresh) {
            return OdaResponse.success<T>(
              cached.entry.data as T,
              cached.entry.status,
              new Headers(cached.entry.headers),
              false,
            );
          }
          staleEntry = cached.entry;
        }
      }
    }

    try {
      const response = await this.dispatch(method, path, body, opts);
      const contentType = response.headers["content-type"] ?? "";

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = contentType.includes("application/json")
            ? await response.json()
            : await response.text();
        } catch {
          errorBody = null;
        }
        const error = new OdaHttpError(
          response.status,
          response.statusText,
          errorBody,
          response.url,
        );
        return OdaResponse.failure<T>(
          error,
          response.status,
          new Headers(response.headers),
        );
      }

      const data = contentType.includes("application/json")
        ? ((await response.json()) as T)
        : ((await response.text()) as unknown as T);

      // Store in cache
      if (isGet && this._cache && cacheKey) {
        await this._cache.set(cacheKey, data, response.status, response.headers);
      }

      return OdaResponse.success<T>(
        data,
        response.status,
        new Headers(response.headers),
      );
    } catch (err) {
      // Stale-on-error fallback
      if (isGet && staleEntry) {
        return OdaResponse.success<T>(
          staleEntry.data as T,
          staleEntry.status,
          new Headers(staleEntry.headers),
          true,
        );
      }

      if (err instanceof OdaTimeoutError) {
        return OdaResponse.failure<T>(err, null, null);
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        return OdaResponse.failure<T>(err, null, null);
      }
      return OdaResponse.failure<T>(err as Error, null, null);
    }
  }

  get<T = unknown>(
    path: string,
    opts?: OdaRequestOptions,
  ): Promise<OdaResponse<T>> {
    return this.execute<T>("GET", path, undefined, opts);
  }

  post<T = unknown>(
    path: string,
    opts?: OdaBodyRequestOptions,
  ): Promise<OdaResponse<T>> {
    const { body, ...rest } = opts ?? {};
    return this.execute<T>("POST", path, body, rest);
  }

  put<T = unknown>(
    path: string,
    opts?: OdaBodyRequestOptions,
  ): Promise<OdaResponse<T>> {
    const { body, ...rest } = opts ?? {};
    return this.execute<T>("PUT", path, body, rest);
  }

  patch<T = unknown>(
    path: string,
    opts?: OdaBodyRequestOptions,
  ): Promise<OdaResponse<T>> {
    const { body, ...rest } = opts ?? {};
    return this.execute<T>("PATCH", path, body, rest);
  }

  delete<T = unknown>(
    path: string,
    opts?: OdaRequestOptions,
  ): Promise<OdaResponse<T>> {
    return this.execute<T>("DELETE", path, undefined, opts);
  }
}
