/** Normalised request passed to every engine. */
export type OdaEngineRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: BodyInit | null;
  signal?: AbortSignal;
};

/**
 * Normalised response returned by every engine.
 * Body is exposed lazily via `json()` and `text()` — oda decides when to read it.
 */
export type OdaEngineResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  ok: boolean;
  url: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

export interface OdaEngine {
  execute(request: OdaEngineRequest): Promise<OdaEngineResponse>;
}

/**
 * Built-in fetch engine — works in any environment that exposes the
 * WHATWG `fetch` API (browsers, Deno, Bun, Node ≥ 18, Tauri…).
 */
export const fetchEngine: OdaEngine = {
  async execute({ url, method, headers, body, signal }) {
    const res = await fetch(url, { method, headers, body, signal });
    return {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      ok: res.ok,
      url: res.url,
      json: () => res.json(),
      text: () => res.text(),
    };
  },
};

/** Module-level global engine — used when no client-level engine is provided. */
let _globalEngine: OdaEngine = fetchEngine;

export function getGlobalEngine(): OdaEngine {
  return _globalEngine;
}

export function setGlobalEngine(engine: OdaEngine): void {
  _globalEngine = engine;
}
