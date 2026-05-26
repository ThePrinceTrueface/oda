**1. Intercepteurs**

Le pattern le plus demandé après la base. Permet d'injecter de la logique avant/après chaque requête sans répéter du code dans chaque appel.

```typescript
const client = oda.http.client("https://api.example.com", {
  interceptors: {
    request: (req) => {
      req.headers["X-Request-Id"] = crypto.randomUUID();
      return req;
    },
    response: (res) => {
      if (res.status() === 401) authStore.logout();
      return res;
    },
  },
});
```

---

**2. Retry automatique**

Relancer automatiquement une requête échouée selon des conditions configurables.

```typescript
const client = oda.http.client("https://api.example.com", {
  retry: {
    attempts: 3,
    delay: 1000,           // ms entre chaque tentative
    on: [500, 502, 503],   // status codes qui déclenchent le retry
  },
});
```

---

**3. Cache**

Mettre en cache les réponses GET pour éviter des appels réseau redondants.

```typescript
const client = oda.http.client("https://api.example.com", {
  cache: {
    ttl: 60_000,                        // durée de vie en ms
    storage: oda.helper.localStorage(), // même interface OdaQueueStore
    key: (req) => req.url,              // clé de cache custom
  },
});
```

---

**4. `oda.ws` — WebSocket**

Étendre `oda` au-delà du HTTP avec un client WebSocket cohérent avec la même philosophie.

```typescript
const socket = oda.ws.connect("wss://api.example.com/live", {
  engine: bunWsEngine,
  reconnect: { attempts: 5, delay: 2000 },
});

socket.on("message", (data) => console.log(data));
socket.send({ type: "ping" });
```

---

**5. Logging / telemetry hook**

Un hook dédié à l'observabilité — plus léger qu'un intercepteur, non-bloquant.

```typescript
const client = oda.http.client("https://api.example.com", {
  onRequest:  (req) => logger.info(`→ ${req.method} ${req.url}`),
  onResponse: (res) => logger.info(`← ${res.status()}`),
  onError:    (err) => logger.error(err),
});
```

---


**7. Pagination helper**

Un utilitaire pour consommer des APIs paginées sans écrire la boucle à la main.

```typescript
const pages = oda.http.paginate(client, "/users", {
  query: (page) => ({ page, limit: 20 }),
  hasMore: (res) => res.data().page < res.data().totalPages,
});

for await (const page of pages) {
  console.log(page.data());
}
```

---
