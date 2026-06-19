![Oda Banner](assets/imgs/oda-barner.png)

# oda

> **The HTTP client that grows with your app.**

Type-safe, runtime-agnostic, and built to scale — from a first fetch to a distributed team, oda gives you one model, zero rewrites, and a security architecture that's structural rather than conventional.

```typescript
import oda from "@oda-kit/client"

const client = oda.http.client("https://api.example.com")
const api    = client.derivate("/api/v1")
const users  = api.derivate("/users")

const res = await users.get<User[]>("/", {
  auth:  { jwt: token },
  query: { page: 1, limit: 20 },
})

if (res.isError()) return handleError(res.status(), res.error())

console.log(res.data()) // → User[]
```

---

## Table of contents

1. [Why oda](#1-why-oda)
2. [Installation](#2-installation)
3. [Core concepts](#3-core-concepts)
4. [Getting started](#4-getting-started)
5. [Client hierarchy — `derivate()`](#5-client-hierarchy--derivate)
6. [Making requests](#6-making-requests)
7. [Handling responses — `OdaResponse<T>`](#7-handling-responses--odaresponset)
8. [Authentication](#8-authentication)
9. [Query params](#9-query-params)
10. [Timeout & cancellation](#10-timeout--cancellation)
11. [Scope enforcement](#11-scope-enforcement)
12. [Response cache](#12-response-cache)
13. [Offline queue](#13-offline-queue)
14. [Pluggable engine](#14-pluggable-engine)
15. [Custom storage — `OdaStorage`](#15-custom-storage--odastorage)
16. [Testing with `oda.mock`](#16-testing-with-odamock)
17. [Error reference](#17-error-reference)
18. [API reference](#18-api-reference)
19. [Migrating from axios / fetch](#19-migrating-from-axios--fetch)

---

## 1. Why oda

Most HTTP clients solve one problem: making requests. oda solves a different one — **structuring how your app talks to the network**, from day one to year five.

### The problem with existing solutions

Every team eventually builds the same wrappers around `fetch` or `axios`: base URL configuration, auth header injection, timeout management, error normalisation, environment-specific logic. It's boilerplate that gets copy-pasted, diverges across features, and becomes a hidden source of bugs and inconsistency.

```typescript
// What most codebases look like after 6 months
const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/users/${id}`, {
  headers: {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  },
})
if (!res.ok) throw new Error(...)
return res.json() as User
```

Repeated. Everywhere. With subtle differences each time.

### What oda does differently

oda gives your network layer a **structure** — not just a function. A client tree where each node inherits configuration, enforces its own URL scope, and can be reasoned about independently.

```typescript
// What the same codebase looks like with oda
const res = await users.get<User>(`/${id}`, { auth: { jwt: token } })
if (res.isError()) handleError(res.error())
return res.data()
```

The base URL, the scope, the timeout — all defined once, in one place, enforced automatically.

### oda is the right choice when

- You want **one model** that works from prototype to production
- You're building for **multiple runtimes** (browser, Tauri, Node, Bun)
- You want **security to be structural**, not a matter of discipline
- You want **tests without MSW** or heavy mocking infrastructure
- You're tired of rewriting the same HTTP wrapper in every project

---

## 2. Installation

```bash
# npm
npm install oda

# yarn
yarn add oda

# pnpm
pnpm add oda

# bun
bun add oda
```

**Requirements:** TypeScript 5.0+, ES2020 target. No polyfills needed for modern browsers, Node ≥ 18, Bun, or Tauri.

---

## 3. Core concepts

Understanding these four concepts is enough to use oda at full power.

### Client tree

oda is built around a hierarchy of clients. You create a root client, then derive scoped children from it. Each child inherits parent config and is constrained to its URL scope.

```
oda.http.client("https://api.example.com")
├── derivate("/api/v1")
│   ├── derivate("/users")   → https://api.example.com/api/v1/users/**
│   ├── derivate("/posts")   → https://api.example.com/api/v1/posts/**
│   └── derivate("/auth")    → https://api.example.com/api/v1/auth/**
└── derivate("/cdn")         → https://api.example.com/cdn/**
```

### OdaResponse\<T\>

Every request returns an `OdaResponse<T>` — a result container that wraps success, error, and queued states without ever throwing. You inspect the state, then read the data.

### Pluggable engine

The HTTP transport is an interface. The default is `fetch`, but you can swap it for any runtime (Bun, Node, Axios) without changing a single line of app logic.

### Scope enforcement

By default, a client can only make requests within its `baseURL`. Requests that escape the scope throw `OdaScopeError` immediately — before any network call is made.

---

## 4. Getting started

### Create a root client

```typescript
// src/lib/clients.ts
import oda from "@oda-kit/client"

export const rootClient = oda.http.client("https://api.example.com", {
  defaultTimeout: 8_000,
})
```

### Derive scoped clients

```typescript
// src/lib/clients.ts
export const api   = rootClient.derivate("/api/v1")
export const auth  = api.derivate("/auth")
export const users = api.derivate("/users")
```

### Use them in your features

```typescript
// src/features/users/api.ts
import { users } from "@/lib/clients"

export const usersApi = {
  list:   (token: string) => users.get<User[]>("/", { auth: { jwt: token } }),
  get:    (id: number, token: string) => users.get<User>(`/${id}`, { auth: { jwt: token } }),
  create: (data: CreateUser, token: string) => users.post<User>("/", { body: data, auth: { jwt: token } }),
  update: (id: number, data: Partial<User>, token: string) => users.patch<User>(`/${id}`, { body: data, auth: { jwt: token } }),
  remove: (id: number, token: string) => users.delete<{ success: boolean }>(`/${id}`, { auth: { jwt: token } }),
}
```

> **Convention:** Keep all client definitions in a single file (`src/lib/clients.ts`). Import clients from there — never instantiate them inside components or services.

---

## 5. Client hierarchy — `derivate()`

`derivate()` is the heart of oda. It creates a child client that:

- **Inherits** parent options (timeout, engine, offline queue)
- **Overrides** any option explicitly passed
- **Is constrained** to the derived URL scope

```typescript
const root  = oda.http.client("https://api.example.com", { defaultTimeout: 5_000 })
const api   = root.derivate("/api/v1")              // timeout → 5000 (inherited)
const auth  = api.derivate("/auth", { defaultTimeout: 3_000 }) // timeout → 3000 (override)
const me    = auth.derivate("/me")                  // timeout → 3000 (inherited from auth)
```

### Merge rules

| Option | Behaviour |
|--------|-----------|
| `defaultTimeout` | Child wins if set, otherwise parent |
| `engine` | Child wins if set, otherwise parent, otherwise global |
| `scopeCheck` | Child wins if set, otherwise parent |
| `offlineQueue` | Child wins if set, otherwise parent |
| `baseURL` | Always concatenated: `parent.baseURL + childPath` |

### The scalability property

`derivate()` is an **additive operation** — you never rewrite existing clients, you only add new nodes. A codebase that starts with one client and one derivation grows to dozens without any structural change:

```typescript
// Month 1 — MVP
const client = oda.http.client("https://api.example.com")

// Month 6 — features growing
const api   = client.derivate("/api/v1")
const auth  = api.derivate("/auth")
const users = api.derivate("/users")

// Month 18 — multiple teams
const sessions = auth.derivate("/sessions")
const oauth    = auth.derivate("/oauth")
const profiles = users.derivate("/profiles")
const admin    = api.derivate("/admin")
```

The model never changes. The tree just deepens.

---

## 6. Making requests

All HTTP methods are available on every client. Pass a type parameter to get a fully typed `OdaResponse<T>` — no manual `.json()` calls.

```typescript
// GET
const res = await client.get<User[]>("/users")

// POST — object body is serialized to JSON automatically
const res = await client.post<User>("/users", {
  body: { name: "Alice", email: "alice@example.com" },
})

// PUT
const res = await client.put<User>("/users/1", {
  body: { name: "Alice Updated", email: "alice@example.com" },
})

// PATCH — partial update
const res = await client.patch<User>("/users/1", {
  body: { name: "Alice Patched" },
})

// DELETE
const res = await client.delete<{ success: boolean }>("/users/1")
```

### Absolute URL bypass

If a path starts with `http://` or `https://`, it bypasses base URL resolution and is used as-is. Scope enforcement still applies unless `bypassScope: true` is set.

```typescript
// Absolute URL — useful for CDN, S3 signed URLs, etc.
await client.get("https://cdn.example.com/logo.png", {
  config: { bypassScope: true },
})
```

### FormData and binary bodies

Non-object bodies (Blob, FormData, string) are passed through without serialization. No `Content-Type` is injected — the browser sets it automatically for FormData.

```typescript
const form = new FormData()
form.append("avatar", file)
await client.post<{ url: string }>("/upload", { body: form })
```

---

## 7. Handling responses — `OdaResponse<T>`

Every request returns an `OdaResponse<T>`. It never throws — instead, it wraps three possible outcomes that you inspect explicitly.

```typescript
const res = await users.get<User>("/me", { auth: { jwt: token } })

// 1. Offline — request was enqueued for later
if (res.isInQueue()) {
  showToast("Will sync when back online")
  return
}

// 2. Error — non-2xx, timeout, or abort
if (res.isError()) {
  const err    = res.error()   // OdaHttpError | OdaTimeoutError | Error
  const status = res.status()  // 401, 404, 500… or null
  const body   = res.data()    // server error body if HTTP, null otherwise
  handleError(status, body)
  return
}

// 3. Success — fully typed
const user    = res.data()     // → User
const status  = res.status()   // → 200
const headers = res.headers()  // → Headers
```

### Accessor behaviour

| Accessor | On success | On error | In queue |
|----------|-----------|---------|--------|
| `data()` | Returns `T` | Returns HTTP error body or `null` | Throws `OdaQueueError` |
| `error()` | `null` | Returns error object | `null` |
| `status()` | HTTP status code | Status code or `null` | `null` |
| `headers()` | Response headers | Headers or `null` | `null` |
| `isSuccess()` | `true` | `false` | `false` |
| `isError()` | `false` | `true` | `false` |
| `isInQueue()` | `false` | `false` | `true` |

### Why not throw?

Throwing on HTTP errors forces every call site to wrap in `try/catch`. With `OdaResponse`, every outcome is a value — you handle what matters, ignore what doesn't, and TypeScript guides you through it.

---

## 8. Authentication

Pass `auth.jwt` to inject an `Authorization: Bearer <token>` header automatically. Never mutates your params object.

```typescript
// Per-request
const res = await users.get<User>("/me", { auth: { jwt: token } })

// With other options
const res = await users.get<User[]>("/", {
  auth:   { jwt: token },
  query:  { page: 1, limit: 20 },
  config: { timeout: 3_000 },
})
```

---

## 9. Query params

Pass a `query` object — oda serializes it to a query string automatically.

```typescript
// Simple → ?page=1&limit=20
users.get<User[]>("/", { query: { page: 1, limit: 20 } })

// Arrays → repeated keys → ?role=admin&role=editor
users.get<User[]>("/", { query: { role: ["admin", "editor"] } })

// null / undefined → silently ignored → ?page=1
users.get<User[]>("/", { query: { page: 1, search: undefined } })

// Merges with existing query string → /users?sort=asc&page=2
users.get<User[]>("/?sort=asc", { query: { page: 2 } })
```

---

## 10. Timeout & cancellation

### Timeout

Set a default timeout at client level and override per-request. `0` disables it.

```typescript
// Client-level default — all requests time out after 5s
const client = oda.http.client("https://api.example.com", { defaultTimeout: 5_000 })

// Override per-request
await client.get("/reports/annual", { config: { timeout: 30_000 } })

// Disable for one request (e.g. long upload)
await client.post("/upload", { body: file, config: { timeout: 0 } })
```

### Manual cancellation

Pass an `AbortController` signal to cancel a request at any point. The signal merges with the internal timeout controller — whichever fires first cancels the request.

```typescript
const controller = new AbortController()

const res = await client.get<User[]>("/users", {
  config: {
    signal: controller.signal,
    timeout: 5_000, // both active simultaneously — first wins
  },
})

// Cancel manually
controller.abort()
```

### React pattern

```typescript
useEffect(() => {
  const controller = new AbortController()

  client.get<User[]>("/users", { config: { signal: controller.signal } })
    .then((res) => { if (!res.isError()) setUsers(res.data()) })

  return () => controller.abort() // cleanup on unmount
}, [])
```

---

## 11. Scope enforcement

By default, every client enforces its `baseURL` as a hard boundary. Requests that attempt to escape it throw `OdaScopeError` immediately — before any network call is made.

```typescript
const api  = oda.http.client("https://api.example.com/api/v1")
const auth = api.derivate("/auth") // scope: https://api.example.com/api/v1/auth

auth.get("/me")                            // ✓ → .../auth/me
auth.get("https://api.example.com/users")  // ✗ OdaScopeError — outside /auth
auth.get("https://evil.com")               // ✗ OdaScopeError
```

### Why this matters

Every `derivate()` call reduces the attack surface. A bug, a compromised dependency, or user-controlled input in a URL can never escape the client's scope:

```
Without scope  → attack surface = all of the internet
Root client    → attack surface = https://api.example.com/**
Derivate /auth → attack surface = https://api.example.com/api/v1/auth/**
```

### Explicit bypass

When you genuinely need to call an external domain (e.g. S3 signed URLs), opt out explicitly. Every bypass is visible and grep-able.

```typescript
// Intentional and searchable — grep bypassScope across the whole codebase
await client.post(s3SignedUrl, {
  body: file,
  config: { bypassScope: true },
})
```

```bash
# Audit all scope bypasses in the project
grep -r "bypassScope: true" src/
# → 2 results: upload.ts, webhook.ts
```

### Disable at client level

For clients that intentionally call multiple domains (e.g. a CDN client):

```typescript
const cdnClient = oda.http.client("https://cdn.example.com", {
  scopeCheck: false,
})
```

---

## 12. Response cache

oda caches GET responses automatically when a `cache` option is configured on the client. No manual wiring — just configure once, and every GET benefits.

### Setup

```typescript
import oda from "@oda-kit/client"

const client = oda.http.client("https://api.example.com", {
  cache: {
    ttl:     60_000,                                  // 60s time-to-live
    storage: oda.helper.localStorage("api-cache"),    // persisted across reloads
    key:     (req) => req.url,                        // default — can be customised
  },
})
```

### How it works

```
GET request
  ↓
Cache hit + TTL valid   → returned immediately, zero network call
Cache hit + TTL expired → fresh fetch triggered
  ↓ fetch OK  → cache updated → fresh data returned
  ↓ fetch KO  → stale entry returned as fallback → res.isStale() === true
Cache miss              → fetch → stored in cache if successful
```

### Detecting stale data

When the network fails and oda falls back to an expired cache entry, `res.isStale()` returns `true`. Use it to inform the user.

```typescript
const res = await users.get<User[]>("/")

if (res.isStale()) {
  showBanner("You're seeing cached data — reconnecting…")
}

console.log(res.data()) // → User[] — available even when the network is down
```

### Bypassing the cache for a single request

Force a fresh network call without disabling caching. The response is still written to the cache afterward — subsequent normal calls will benefit from it.

```typescript
// Always fetch fresh, but populate the cache for next time
const res = await users.get<User[]>("/", {
  config: { bypassCache: true },
})
```

Typical use case: a "Refresh" button in the UI.

```typescript
async function onRefreshClick() {
  const res = await users.get<User[]>("/", { config: { bypassCache: true } })
  if (res.isSuccess()) setUsers(res.data())
}
```

### Manual cache invalidation

Invalidate entries after a mutation so the next read fetches fresh data.

```typescript
// Exact key
await client.cache.invalidate("https://api.example.com/api/v1/users")

// Wildcard — all entries matching the pattern
await client.cache.invalidate("https://api.example.com/api/v1/users/*")

// Clear everything
await client.cache.clear()
```

Pattern after a mutation:

```typescript
const res = await users.post<User>("/", { body: newUser })
if (res.isSuccess()) {
  await client.cache.invalidate("/users") // next GET will be fresh
}
```

### Custom cache key

By default the cache key is the full URL. Override it to include auth context, locale, or any other dimension.

```typescript
cache: {
  ttl: 30_000,
  key: (req) => {
    const url    = new URL(req.url)
    const locale = req.headers["accept-language"] ?? "en"
    return `${url.pathname}?${url.searchParams}&locale=${locale}`
  },
}
```

### Storage

The `cache.storage` option accepts any `OdaStorage` implementation — the same interface used by the offline queue. See [section 15](#15-custom-storage--odastorage) for how to implement your own.

| Backend | Setup | Persistence |
|---------|-------|-------------|
| In-memory (default) | No `storage` option needed | Cleared on page reload |
| localStorage | `oda.helper.localStorage("key")` | Survives page reload |
| Custom (Tauri, IndexedDB…) | Implement `OdaStorage` | Your choice |

---

## 13. Offline queue

Mark individual requests as offline-capable with `config.offline: true`. If the device has no connectivity, the request is enqueued and replayed automatically at reconnection. Returns `{ queued: true }` immediately — the app stays responsive.

### Setup

```typescript
import oda from "@oda-kit/client"

const client = oda.http.client("https://api.example.com", {
  offlineQueue: {
    detector: oda.helper.browserOfflineDetector(), // required — factory call
    storage:  oda.helper.localStorage("queue"),    // optional, defaults to in-memory
    onError:  (req, err) => console.error("Replay failed", req.id, err),
  },
})
```

### Usage

```typescript
const res = await client.post<Action>("/actions", {
  body: payload,
  config: { offline: true }, // opt-in per request
})

if (res.isInQueue()) {
  showToast("Saved — will sync when back online")
} else {
  updateUI(res.data())
}
```

### Storage backends

| Backend | Setup | Persistence |
|---------|-------|-------------|
| In-memory (default) | No config needed | Lost on app close |
| `localStorage` | `oda.helper.localStorage("queue")` | Survives refresh |
| Custom (Tauri, IndexedDB…) | Implement `OdaStorage` | Your choice |

### Custom detector — `OdaOfflineDetector`

The detector is a factory — call it to get the `OdaOfflineDetector` oda needs.

```typescript
// Node / Bun — never offline (implement the interface directly)
const nodeDetector: OdaOfflineDetector = {
  isOffline:   () => false,
  onReconnect: (_cb) => void 0,
}

// Tauri — via event system
const tauriDetector: OdaOfflineDetector = {
  isOffline:   () => !navigator.onLine,
  onReconnect: (cb) => listen("tauri://network-status", (e) => {
    if (e.payload === "online") cb()
  }),
}
```

---

## 14. Pluggable engine

The HTTP transport is an interface (`OdaEngine`) with a single `execute()` method. Swap it to target any runtime — without changing a line of app logic.

### Setting the global engine

```typescript
// Once at app startup — applies to all clients that don't specify their own
oda.setEngine(bunEngine)
```

### Per-client engine

```typescript
const client = oda.http.client("https://api.example.com", {
  engine: nodeEngine, // overrides the global for this client and its derivations
})
```

### Built-in engine

```typescript
import { fetchEngine } from "oda"
// Uses the WHATWG fetch API — works in browsers, Tauri, Deno, Bun, Node ≥ 18
// This is the default global engine
```

### Implementing a custom engine

```typescript
import type { OdaEngine } from "oda"

// Bun
const bunEngine: OdaEngine = {
  async execute({ url, method, headers, body, signal }) {
    const res = await Bun.fetch(url, { method, headers, body, signal })
    return {
      status:     res.status,
      statusText: res.statusText,
      headers:    Object.fromEntries(res.headers.entries()),
      ok:         res.ok,
      url:        res.url,
      json:       () => res.json(),
      text:       () => res.text(),
    }
  },
}

// Axios (migration path)
const axiosEngine: OdaEngine = {
  async execute({ url, method, headers, body }) {
    const res = await axios({ url, method, headers, data: body })
    return {
      status:     res.status,
      statusText: res.statusText,
      headers:    res.headers as Record<string, string>,
      ok:         res.status >= 200 && res.status < 300,
      url,
      json:       async () => res.data,
      text:       async () => JSON.stringify(res.data),
    }
  },
}
```

---

## 15. Custom storage — `OdaStorage`

`OdaStorage` is the single normalised storage interface used by all oda modules — the offline queue, the response cache, and any future persistence layer. Implement it once to plug any backend into everything.

### The interface

```typescript
interface OdaStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}
```

Values are always plain strings — each oda module handles its own JSON serialisation internally. The storage only stores and retrieves strings.

### Helper pattern — all helpers are factories

Every built-in helper follows the same pattern: a function you call with your parameters that returns the object oda needs internally. Your custom helpers should follow the same convention.

```typescript
// Built-in helpers — factory functions
oda.helper.localStorage("users")       // (namespace) → OdaStorage
oda.helper.browserOfflineDetector()    // () → OdaOfflineDetector

// Your custom helper — same pattern
function myTauriStorage(filename: string): OdaStorage {
  return {
    async get(key)        { ... },
    async set(key, value) { ... },
    async delete(key)     { ... },
    async clear()         { ... },
  }
}

function myNodeDetector(): OdaOfflineDetector {
  return {
    isOffline:   () => false,
    onReconnect: (_cb) => void 0,
  }
}
```

### Example — tauri-plugin-store adapter

```typescript
import { Store } from "@tauri-apps/plugin-store"
import type { OdaStorage } from "oda"

function tauriStorage(filename: string): OdaStorage {
  return {
    async get(key) {
      const store = await Store.load(filename)
      return (await store.get<string>(key)) ?? null
    },
    async set(key, value) {
      const store = await Store.load(filename)
      await store.set(key, value)
      await store.save()
    },
    async delete(key) {
      const store = await Store.load(filename)
      await store.delete(key)
      await store.save()
    },
    async clear() {
      const store = await Store.load(filename)
      await store.clear()
      await store.save()
    },
  }
}

// Usage — drop-in for any oda module
const client = oda.http.client("https://api.example.com", {
  offlineQueue: {
    storage:  tauriStorage("oda-queue.json"),
    detector: oda.helper.browserOfflineDetector(),
  },
  cache: {
    ttl:     60_000,
    storage: tauriStorage("oda-cache.json"),
  },
})
```

### Example — IndexedDB adapter

```typescript
function idbStorage(dbName: string): OdaStorage {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onupgradeneeded = () => req.result.createObjectStore("kv")
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  const tx = async (mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest) => {
    const db = await open()
    return new Promise<unknown>((resolve, reject) => {
      const store = db.transaction("kv", mode).objectStore("kv")
      const req = fn(store)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  return {
    get:    (key) => tx("readonly",  (s) => s.get(key)) as Promise<string | null>,
    set:    (key, val) => tx("readwrite", (s) => s.put(val, key)).then(() => void 0),
    delete: (key) => tx("readwrite", (s) => s.delete(key)).then(() => void 0),
    clear:  () => tx("readwrite", (s) => s.clear()).then(() => void 0),
  }
}
```

---

## 16. Testing with `oda.mock`

`oda.mock` is a built-in mock engine designed to replace MSW, `nock`, or `jest.spyOn(fetch)` in unit and integration tests. No service workers, no configuration, no external dependencies.

### Basic setup

```typescript
import oda from "@oda-kit/client"

const mock = oda.mock.engine([
  { match: "GET /users",     respond: { data: [{ id: 1, name: "Alice" }], status: 200 } },
  { match: "POST /users",    respond: { data: { id: 2, name: "Bob" },     status: 201 } },
  { match: "GET /forbidden", respond: { status: 403 } },
])

const client = oda.http.client("https://api.example.com", { engine: mock })
```

### Wildcard matching

```typescript
{ match: "GET /users/*" }        // → /users/1, /users/42, /users/abc
{ match: "DELETE /users/*/*" }   // → /users/1/posts/5
```

### Dynamic responses

```typescript
{
  match: "GET /users/*",
  respond: (req) => ({
    data:   { id: Number(req.url.split("/").pop()), name: "Alice" },
    status: 200,
  }),
}
```

### Sequential responses

Different response on each call — ideal for testing retry logic or loading states:

```typescript
{
  match: "GET /users",
  respond: [
    { status: 500 },                               // 1st call → server error
    { status: 500 },                               // 2nd call → still failing
    { data: [{ id: 1 }], status: 200 },            // 3rd call → success
  ],
}
```

### Latency simulation

```typescript
{
  match: "GET /reports",
  respond: { data: { rows: [] }, status: 200 },
  config: { latency: 1_200 },                       // fixed 1.2s delay
}

{
  match: "GET /search",
  respond: { data: [], status: 200 },
  config: { latency: { min: 100, max: 600 } },      // random delay
}
```

### Network failure simulation

```typescript
{ match: "GET /flaky",   respond: { throw: "network" } }  // network error
{ match: "GET /slow",    respond: { throw: "timeout" } }  // OdaTimeoutError
{ match: "GET /aborted", respond: { throw: "abort" } }    // AbortError
```

### Introspection — test assertions

```typescript
// Was this endpoint called?
mock.wasCalled("POST /users")               // → boolean

// How many times?
mock.callCount("GET /users")                // → number

// Full call history — inspect body, headers, URL
const calls = mock.calls("POST /users")
const body  = JSON.parse(calls[0].request.body as string)
expect(body.name).toBe("Alice")

// Verify auth header was injected
expect(calls[0].request.headers["authorization"]).toBe("Bearer my-token")

// All calls regardless of route
mock.calls()                                // → OdaMockCall[]
```

### Reset between tests

```typescript
beforeEach(() => mock.reset()) // clears call history and sequential indexes
```

### A complete test suite

```typescript
describe("usersApi", () => {
  const mock = oda.mock.engine([
    { match: "GET /users",    respond: { data: [{ id: 1 }], status: 200 } },
    { match: "POST /users",   respond: { data: { id: 2 },   status: 201 } },
    { match: "DELETE /users/*", respond: { data: { success: true }, status: 200 } },
  ])

  const client = oda.http.client("https://api.example.com", { engine: mock })
  const api    = client.derivate("/users")

  beforeEach(() => mock.reset())

  test("lists users", async () => {
    const res = await api.get<User[]>("/")
    expect(res.isSuccess()).toBe(true)
    expect(res.data()).toHaveLength(1)
  })

  test("creates a user and sends the right body", async () => {
    await api.post("/", { body: { name: "Alice" }, auth: { jwt: "token" } })

    expect(mock.wasCalled("POST /users")).toBe(true)
    const [call] = mock.calls("POST /users")
    expect(JSON.parse(call.request.body as string).name).toBe("Alice")
    expect(call.request.headers["authorization"]).toBe("Bearer token")
  })

  test("delete is called exactly once", async () => {
    await api.delete("/1", { auth: { jwt: "token" } })
    expect(mock.callCount("DELETE /users/*")).toBe(1)
  })
})
```

---

## 17. Error reference

oda uses dedicated error classes so you can handle each failure mode precisely with `instanceof`.

| Class | When thrown | Key properties |
|-------|-------------|---------------|
| `OdaHttpError` | Server responded with a non-2xx status | `status`, `statusText`, `body`, `url` |
| `OdaTimeoutError` | Request exceeded the configured timeout | `url`, `ms` |
| `OdaScopeError` | URL is outside the client's allowed scope | `url`, `scope` |
| `OdaQueueError` | `data()` called on a queued response | — |
| `OdaMockError` | No mock rule matched (strict fallback) | `request` |
| `DOMException (AbortError)` | Request cancelled via `AbortController` | `name === "AbortError"` |

```typescript
import { OdaHttpError, OdaTimeoutError, OdaScopeError } from "oda"

const res = await client.get<User>("/me")

if (res.isError()) {
  const e = res.error()

  if (e instanceof OdaHttpError) {
    switch (e.status) {
      case 401: return redirectToLogin()
      case 403: return showForbidden()
      case 404: return showNotFound()
      case 422: return showValidationErrors(e.body)
      default:  return showGenericError(e.statusText)
    }
  }

  if (e instanceof OdaTimeoutError) return showTimeout(e.ms)
  if (e instanceof DOMException && e.name === "AbortError") return // cancelled intentionally
}
```

---

## 18. API reference

### `oda`

| Member | Signature | Description |
|--------|-----------|-------------|
| `oda.http.client()` | `(url, options?) → OdaHttpClient` | Creates a root HTTP client |
| `oda.mock.engine()` | `(rules, options?) → OdaMockEngine` | Creates a mock engine for testing |
| `oda.helper.localStorage()` | `(namespace) → OdaStorage` | localStorage-backed storage (queue & cache) |
| `oda.helper.browserOfflineDetector()` | `() → OdaOfflineDetector` | Browser/Tauri connectivity detector |
| `oda.setEngine()` | `(engine) → void` | Sets the global HTTP engine |

### `OdaHttpClient`

| Method | Description |
|--------|-------------|
| `.derivate(path, options?)` | Creates a scoped child client |
| `.get<T>(path, opts?)` | GET request — cached if client has `cache` configured |
| `.post<T>(path, opts?)` | POST request |
| `.put<T>(path, opts?)` | PUT request |
| `.patch<T>(path, opts?)` | PATCH request |
| `.delete<T>(path, opts?)` | DELETE request |
| `.cache.invalidate(pattern?)` | Invalidates cache entries matching the pattern |
| `.cache.clear()` | Clears the entire cache |

### `OdaResponse<T>`

| Method | Returns | Description |
|--------|---------|-------------|
| `.isSuccess()` | `boolean` | True on 2xx |
| `.isError()` | `boolean` | True on failure |
| `.isInQueue()` | `boolean` | True when queued |
| `.isStale()` | `boolean` | True when data comes from an expired cache fallback |
| `.data()` | `T \| unknown` | Response body, error body, or throws `OdaQueueError` if queued |
| `.error()` | `OdaHttpError \| OdaTimeoutError \| Error \| null` | Error object |
| `.status()` | `number \| null` | HTTP status code |
| `.headers()` | `Headers \| null` | Response headers |

### `OdaConfig` (per-request)

| Key | Type | Description |
|-----|------|-------------|
| `timeout` | `number` | Per-request timeout in ms. Overrides client `defaultTimeout`. |
| `signal` | `AbortSignal` | External abort signal — merged with internal timeout controller. |
| `offline` | `boolean` | If true and offline, enqueues the request instead of sending. |
| `bypassScope` | `boolean` | Allows request outside the client's URL scope. |
| `bypassCache` | `boolean` | Skips cache read — always fetches fresh. Response is still cached. |

### `OdaStorage`

| Method | Description |
|--------|-------------|
| `.get(key)` | Returns the stored string value or `null` |
| `.set(key, value)` | Stores a string value |
| `.delete(key)` | Removes an entry |
| `.clear()` | Removes all entries |

### `OdaMockEngine`

| Method | Description |
|--------|-------------|
| `.calls(match?)` | All recorded calls, optionally filtered |
| `.callCount(match)` | Number of calls matching the pattern |
| `.wasCalled(match)` | True if the pattern was called at least once |
| `.reset()` | Clears history and resets sequential indexes |

---

## 19. Migrating from axios / fetch

### From fetch

```typescript
// Before
const res = await fetch(`${BASE_URL}/users/${id}`, {
  headers: { Authorization: `Bearer ${token}` },
})
if (!res.ok) throw new Error(res.statusText)
const user = await res.json() as User

// After
const res = await users.get<User>(`/${id}`, { auth: { jwt: token } })
if (res.isError()) handleError(res.error())
const user = res.data()
```

### From axios

```typescript
// Before — axios instance
const api = axios.create({ baseURL: "https://api.example.com/api/v1", timeout: 5000 })
const { data } = await api.get<User[]>("/users", {
  headers: { Authorization: `Bearer ${token}` },
  params: { page: 1 },
})

// After — oda client
const api = oda.http.client("https://api.example.com/api/v1", { defaultTimeout: 5_000 })
const res = await api.get<User[]>("/users", {
  auth:  { jwt: token },
  query: { page: 1 },
})
const data = res.data()
```

### Incremental migration with the axios engine

Don't want to swap everything at once? Use oda's architecture while keeping axios under the hood:

```typescript
import oda, { type OdaEngine } from "@oda-kit/client"
import axios from "axios"

const axiosEngine: OdaEngine = {
  async execute({ url, method, headers, body }) {
    const res = await axios({ url, method, headers, data: body })
    return {
      status: res.status, statusText: res.statusText,
      headers: res.headers as Record<string, string>,
      ok: res.status >= 200 && res.status < 300,
      url, json: async () => res.data, text: async () => JSON.stringify(res.data),
    }
  },
}

// oda structure and DX, axios transport underneath
oda.setEngine(axiosEngine)
const client = oda.http.client("https://api.example.com")
```

Swap the engine to `fetchEngine` when you're ready — zero changes to app code.

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

<div align="center">

**oda** — built for the apps you're building today and the scale you'll reach tomorrow.

</div>
