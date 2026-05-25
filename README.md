# oda 🌊

**oda** is a lightweight TypeScript HTTP client built around scoped, derivable clients. Swap the engine for any JS runtime, queue requests offline and replay them on reconnect, and stay in full control of how and where your app talks to the network.

---

## 📋 Table of Contents

- [Core Philosophy](#-core-philosophy)
- [Installation](#-installation)
- [The Result Pattern (`OdaResponse`)](#-the-result-pattern-odaresponse)
- [Offline Capability](#-offline-capability)
  - [Setup](#setup)
  - [How it Works](#how-it-works)
  - [Custom Detectors & Storage](#custom-detectors--storage)
- [Client Configuration](#-client-configuration)
  - [Initialization](#initialization)
  - [Derived Clients](#derived-clients)
- [Scope Management](#-scope-management)
- [Custom Engines](#-custom-engines)
- [API Reference](#-api-reference)
  - [Interfaces](#interfaces)
  - [Error Classes](#error-classes)
- [License](#-license)

---

## 🧠 Core Philosophy

Most HTTP clients throw errors for non-2xx statuses, forcing you to wrap every call in a `try/catch`. `oda` treats errors as **data**. Every request returns an `OdaResponse` container that explicitly tells you if it succeeded, failed, or was queued due to lack of connectivity.

---

## 🚀 Installation

```bash
pnpm add oda
# or
npm install oda
# or
yarn add oda
```

---

## 📦 The Result Pattern (`OdaResponse`)

Every method (`get`, `post`, etc.) returns a `Promise<OdaResponse<T>>`.

```typescript
const res = await api.get<User>("/me");

if (res.isInQueue()) {
  // Request is saved for later (offline mode)
  return notify("Will sync when back online");
}

if (res.isError()) {
  // Handle HTTP errors (4xx, 5xx) or Network errors (timeout, abort)
  const error = res.error();
  console.error(`Error ${res.status()}:`, error.message);
  return;
}

// Success! data() is typed as User
const user = res.data();
```

### Response Methods
| Method | Description |
| :--- | :--- |
| `isSuccess()` | Returns `true` for 2xx status codes. |
| `isError()` | Returns `true` for 4xx/5xx statuses, timeouts, or manual aborts. |
| `isInQueue()` | Returns `true` if the request was enqueued because the client is offline. |
| `data()` | Returns the parsed body. Throws `OdaQueueError` if called while in queue. |
| `status()` | Returns the numeric status code (or `null` if no response was received). |
| `headers()` | Returns a `Headers` object. |
| `error()` | Returns the underlying error (`OdaHttpError`, `OdaTimeoutError`, or `Error`). |

---

## 📶 Offline Capability

`oda` can intercept requests when there is no internet connection, store them, and replay them automatically when the connection returns.

### Setup
```typescript
import oda from 'oda';

const api = oda.http.client("https://api.example.com", {
  offlineQueue: {
    // 1. Persistent storage (browsers/Tauri)
    storage: oda.helper.localStorage("api-queue"),
    // 2. Connectivity detector
    detector: oda.helper.browserOfflineDetector,
    // 3. Optional error handler for replays
    onError: (req, error) => console.error(`Replay failed for ${req.url}`)
  }
});

// To enable offline queuing for a specific request:
await api.post("/sync", {
  body: { state: "updated" },
  config: { offline: true } // Opt-in
});
```

### Custom Detectors & Storage
You can implement your own logic for different environments (Node, Bun, React Native).

```typescript
// Custom Store (e.g., using SQLite or Redis)
const myStore: OdaQueueStore = {
  async load() { /* ... */ },
  async save(queue) { /* ... */ }
};

// Custom Detector (e.g., using a native module)
const myDetector: OdaOfflineDetector = {
  isOffline: () => checkNativeConnectivity(),
  onReconnect: (callback) => onNativeReconnect(callback)
};
```

---

## 🛠️ Client Configuration

### Initialization
```typescript
const client = oda.http.client("https://api.example.com", {
  defaultTimeout: 5000, // 5 seconds
  engine: myCustomEngine,
  offlineQueue: { /* ... */ }
});
```

### Derived Clients
Create specialized clients that inherit and extend parent settings. Perfect for versioned APIs or specific modules.

```typescript
const api = oda.http.client("https://api.example.com");

// Inherits baseURL, adds /v1/auth suffix and custom timeout
const auth = api.derivate("/v1/auth", { defaultTimeout: 2000 });

// Points to https://api.example.com/v1/auth/login
await auth.post("/login", { body: credentials });
```

---

## ⚙️ Custom Engines

By default, `oda` uses the global `fetch` API. You can override this globally or per-client.

```typescript
import oda, { OdaEngine } from 'oda';

const axiosEngine: OdaEngine = {
  async execute({ url, method, headers, body, signal }) {
    const res = await axios({ url, method, headers, data: body, signal });
    return {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      ok: res.status >= 200 && res.status < 300,
      url,
      json: async () => res.data,
      text: async () => JSON.stringify(res.data),
    };
  }
};

oda.setEngine(axiosEngine);
```

---

## 📖 API Reference

### Interfaces

#### `OdaRequestOptions`
| Property | Type | Description |
| :--- | :--- | :--- |
| `query` | `Record<string, any>` | Query parameters to append to the URL. |
| `headers` | `Record<string, string>` | Custom HTTP headers. |
| `auth` | `{ jwt?: string }` | Convenience helper for Bearer tokens. |
| `config` | `OdaConfig` | Per-request configuration (timeout, offline, signal). |

#### `OdaConfig`
- `timeout`: Override client timeout for this request (0 to disable).
- `offline`: Boolean. If true, allows enqueuing if offline.
- `signal`: An `AbortSignal` to cancel the request manually.

### Error Classes
- `OdaHttpError`: Thrown for non-2xx responses. Contains `status`, `statusText`, and `body`.
- `OdaTimeoutError`: Thrown when the request exceeds the configured time.
- `OdaQueueError`: Thrown if you try to access `.data()` on a queued response.

---

## 👨‍💻 Author

Developed by **The Prince True-face** as part of the **ebinasoft** organization.

## 📜 License

ISC
ng, any>` | Query parameters to append to the URL. |
| `headers` | `Record<string, string>` | Custom HTTP headers. |
| `auth` | `{ jwt?: string }` | Convenience helper for Bearer tokens. |
| `config` | `OdaConfig` | Per-request configuration (timeout, offline, signal). |

#### `OdaConfig`
- `timeout`: Override client timeout for this request (0 to disable).
- `offline`: Boolean. If true, allows enqueuing if offline.
- `signal`: An `AbortSignal` to cancel the request manually.

### Error Classes
- `OdaHttpError`: Thrown for non-2xx responses. Contains `status`, `statusText`, and `body`.
- `OdaTimeoutError`: Thrown when the request exceeds the configured time.
- `OdaQueueError`: Thrown if you try to access `.data()` on a queued response.

---

## 👨‍💻 Author

Developed by **The Prince True-face** as part of the **ebinasoft** organization.

## 📜 License

ISC
