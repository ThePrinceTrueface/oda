export interface OdaStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory storage — fast, zero config, cleared on page reload. */
export class MemoryStorage implements OdaStorage {
  private readonly store = new Map<string, string>();
  async get(key: string) { return this.store.get(key) ?? null; }
  async set(key: string, value: string) { this.store.set(key, value); }
  async delete(key: string) { this.store.delete(key); }
  async clear() { this.store.clear(); }
}

/** window.localStorage-backed storage — persists across page reloads. */
export class LocalStorage implements OdaStorage {
  private readonly ns: string;
  private readonly store = window.localStorage;

  constructor(namespace: string) {
    this.ns = `oda:${namespace}:`;
  }

  async get(key: string): Promise<string | null> {
    try { return this.store.getItem(this.ns + key); }
    catch { return null; }
  }

  async set(key: string, value: string): Promise<void> {
    try { this.store.setItem(this.ns + key, value); }
    catch { console.warn(`[oda:storage] Failed to write "${key}" to localStorage`); }
  }

  async delete(key: string): Promise<void> {
    this.store.removeItem(this.ns + key);
  }

  async clear(): Promise<void> {
    Object.keys(this.store)
      .filter((k) => k.startsWith(this.ns))
      .forEach((k) => this.store.removeItem(k));
  }
}

/** Helper factory for localStorage */
export function localStorage(namespace: string): OdaStorage {
  return new LocalStorage(namespace);
}
