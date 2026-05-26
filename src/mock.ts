import { OdaEngine, OdaEngineRequest, OdaEngineResponse, fetchEngine } from "./engine";
import { OdaTimeoutError } from "./errors";

/** Thrown when a request matches no mock rule and fallback is "throw" (default). */
export class OdaMockError extends Error {
  constructor(public readonly request: OdaEngineRequest) {
    super(
      `[oda:mock] No rule matched "${request.method} ${request.url}". ` +
      `Add a matching rule or set fallback: "passthrough".`,
    );
    this.name = "OdaMockError";
  }
}

/** A static mock response definition. */
export type OdaMockResponse = {
  /** Response body — serialized to JSON automatically. */
  data?: unknown;
  /** HTTP status code. Defaults to 200. */
  status?: number;
  /** HTTP status text. Defaults to "OK". */
  statusText?: string;
  /** Additional response headers. */
  headers?: Record<string, string>;
  /**
   * Simulate a network-level failure instead of an HTTP response.
   * "network" → throws a generic network error.
   * "timeout" → throws OdaTimeoutError.
   * "abort"   → throws a DOMException AbortError.
   */
  throw?: "network" | "timeout" | "abort";
};

/** Dynamic response — receives the request and returns a mock response. */
export type OdaMockHandler = (request: OdaEngineRequest) => OdaMockResponse | Promise<OdaMockResponse>;

/** Advanced config for a single mock rule. */
export type OdaMockRuleConfig = {
  /**
   * Simulated network latency in ms.
   * Pass a number for a fixed delay, or a range for a random delay.
   *
   * @example
   * latency: 300                   // fixed 300ms
   * latency: { min: 100, max: 500 } // random between 100ms and 500ms
   */
  latency?: number | { min: number; max: number };
  /**
   * How many times this rule responds before being exhausted.
   * Defaults to Infinity — responds on every matching call.
   */
  repeat?: number;
};

/** A single mock rule. */
export type OdaMockRule = {
  /**
   * Pattern to match against "METHOD /path".
   * Supports exact strings and wildcards (*).
   *
   * @example
   * "GET /users"         // exact
   * "GET /users/*"       // wildcard — matches /users/1, /users/abc
   * "DELETE /users/*/*"  // multi-wildcard
   */
  match: string;
  /**
   * Response(s) to return when the rule matches.
   * Pass an array for sequential responses — each call consumes the next entry.
   * When the array is exhausted, the last entry is repeated.
   */
  respond: OdaMockResponse | OdaMockHandler | Array<OdaMockResponse | OdaMockHandler>;
  /** Advanced config — latency, repeat count. */
  config?: OdaMockRuleConfig;
};

/** Global options for a mock engine instance. */
export type OdaMockEngineOptions = {
  /**
   * What to do when no rule matches the incoming request.
   * - "throw"       → throws OdaMockError (default — strict, test-safe)
   * - "passthrough" → forwards the request to the real network via fetchEngine
   */
  fallback?: "throw" | "passthrough";
};

/** A recorded call entry stored in the call history. */
export type OdaMockCall = {
  request: OdaEngineRequest;
  matchedRule: string | null;
  respondedAt: number;
};

/**
 * A mock engine instance returned by `oda.mock.engine()`.
 * Implements `OdaEngine` — plug it into any client via the `engine` option.
 */
export interface OdaMockEngine extends OdaEngine {
  /** Returns all recorded calls, optionally filtered by a match pattern. */
  calls(match?: string): OdaMockCall[];
  /** Returns the number of times a match pattern was called. */
  callCount(match: string): number;
  /** Returns true if a match pattern was called at least once. */
  wasCalled(match: string): boolean;
  /** Clears the call history and resets sequential response indexes. */
  reset(): void;
}

/**
 * Converts a match string to a RegExp.
 * "*" in the pattern matches any path segment (one or more non-slash chars, or digits).
 */
function matchPatternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex specials except *
    .replace(/\*/g, "[^/]+");              // * → one path segment
  return new RegExp(`^${escaped}$`);
}

/**
 * Normalises an incoming request to a "METHOD /path" key for matching.
 * Strips the base URL and query string — match rules target paths only.
 */
function requestToMatchKey(request: OdaEngineRequest): string {
  try {
    const parsed = new URL(request.url);
    return `${request.method.toUpperCase()} ${parsed.pathname}`;
  } catch {
    return `${request.method.toUpperCase()} ${request.url}`;
  }
}

async function applyLatency(latency: OdaMockRuleConfig["latency"]): Promise<void> {
  if (!latency) return;
  const ms =
    typeof latency === "number"
      ? latency
      : Math.round(latency.min + Math.random() * (latency.max - latency.min));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildEngineResponse(mock: OdaMockResponse): OdaEngineResponse {
  const status     = mock.status     ?? 200;
  const statusText = mock.statusText ?? (status === 200 ? "OK" : String(status));
  const body       = mock.data !== undefined ? JSON.stringify(mock.data) : "";
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...mock.headers,
  };

  return {
    status,
    statusText,
    headers,
    ok: status >= 200 && status < 300,
    url: "",
    json: async () => (mock.data !== undefined ? mock.data : null),
    text: async () => body,
  };
}

/**
 * Creates a mock engine for testing.
 * Rules are matched in order — first match wins.
 */
export function createMockEngine(
  rules: OdaMockRule[],
  options: OdaMockEngineOptions = {},
): OdaMockEngine {
  const fallback = options.fallback ?? "throw";

  // Compiled rules — regex + sequential index per rule
  const compiled = rules.map((rule) => ({
    rule,
    regex:  matchPatternToRegex(rule.match),
    index:  0,  // tracks sequential respond position
    calls:  0,  // tracks repeat count
  }));

  const callHistory: OdaMockCall[] = [];

  async function execute(request: OdaEngineRequest): Promise<OdaEngineResponse> {
    const key = requestToMatchKey(request);

    // Find first matching, non-exhausted rule
    const entry = compiled.find(({ rule, regex, calls: c }) => {
      if (!regex.test(key)) return false;
      const repeat = rule.config?.repeat ?? Infinity;
      return c < repeat;
    });

    if (!entry) {
      callHistory.push({ request, matchedRule: null, respondedAt: Date.now() });

      if (fallback === "passthrough") {
        return fetchEngine.execute(request);
      }
      throw new OdaMockError(request);
    }

    // Increment call counter
    entry.calls++;

    // Record the call
    callHistory.push({
      request,
      matchedRule: entry.rule.match,
      respondedAt: Date.now(),
    });

    // Apply latency
    await applyLatency(entry.rule.config?.latency);

    // Resolve the response — sequential array or single
    const responds = Array.isArray(entry.rule.respond)
      ? entry.rule.respond
      : [entry.rule.respond];

    // Consume next in sequence — clamp to last entry when exhausted
    const responseIndex = Math.min(entry.index, responds.length - 1);
    if (entry.index < responds.length - 1) entry.index++;

    const responder = responds[responseIndex];
    const mock: OdaMockResponse =
      typeof responder === "function" ? await responder(request) : responder;

    // Simulate network-level failures
    if (mock.throw) {
      if (mock.throw === "timeout") {
        throw new OdaTimeoutError(request.url, 0);
      }
      if (mock.throw === "abort") {
        throw new DOMException("Request aborted by mock", "AbortError");
      }
      throw new TypeError(`Network error (simulated by oda mock) — ${request.url}`);
    }

    return buildEngineResponse(mock);
  }

  return {
    execute,

    calls(match?: string): OdaMockCall[] {
      if (!match) return [...callHistory];
      const regex = matchPatternToRegex(match);
      return callHistory.filter((c) => {
        const key = requestToMatchKey(c.request);
        return regex.test(key);
      });
    },

    callCount(match: string): number {
      return this.calls(match).length;
    },

    wasCalled(match: string): boolean {
      return this.callCount(match) > 0;
    },

    reset(): void {
      callHistory.length = 0;
      compiled.forEach((e) => { e.index = 0; e.calls = 0; });
    },
  };
}
