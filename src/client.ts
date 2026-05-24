import { getGlobalEngine, OdaEngine, OdaEngineRequest, OdaEngineResponse } from "./engine";
import { OdaHttpError, OdaTimeoutError } from "./errors";
import { buildQueryURL, mergeHeaders, mergeOptions, resolveURL, withTimeout } from "./helpers";
import { OdaOfflineQueue } from "./offline/queue";
import { OdaResponse } from "./response";
import { BodyPayload, OdaBodyRequestOptions, OdaClientOptions, OdaRequestOptions } from "./types";

export class OdaHttpClient {
  private readonly baseURL: string;
  private readonly options: OdaClientOptions;
  private readonly queue: OdaOfflineQueue | null;
  private readonly engine: OdaEngine;

  constructor(baseURL: string, options: OdaClientOptions = {}) {
    this.baseURL = baseURL.replace(/\/$/, "");
    this.options = options;
    this.engine = options.engine ?? getGlobalEngine();
    this.queue = options.offlineQueue
      ? new OdaOfflineQueue(options.offlineQueue)
      : null;

    if (this.queue) {
      this.queue.setReplayExecutor((entry) =>
        this.dispatch(entry.method, entry.url, undefined, {
          headers: entry.headers,
        }).then(() => void 0),
      );
    }
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
    if (opts.config?.offline && this.queue && this.queue.isOffline()) {
      const headers: Record<string, string> = {};
      if (opts.auth?.jwt) headers["Authorization"] = `Bearer ${opts.auth.jwt}`;
      await this.queue.enqueue(
        method,
        resolveURL(this.baseURL, path),
        body,
        headers,
      );
      return OdaResponse.queued<T>();
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

      return OdaResponse.success<T>(
        data,
        response.status,
        new Headers(response.headers),
      );
    } catch (err) {
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
