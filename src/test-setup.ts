/**
 * Whether `localStorage` exists under test depends on the jsdom version, the Node
 * version, and how Vitest populates globals — Node 22 ships a disabled
 * `localStorage` global of its own, and jsdom only provides one for a non-opaque
 * origin. Rather than diagnose each combination, install a known implementation
 * unconditionally, so tests behave identically on every machine.
 */
class MemoryStorage implements Storage {
  private items = new Map<string, string>();

  get length() {
    return this.items.size;
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.items.get(String(key)) ?? null;
  }

  setItem(key: string, value: string) {
    this.items.set(String(key), String(value));
  }

  removeItem(key: string) {
    this.items.delete(String(key));
  }

  clear() {
    this.items.clear();
  }

  [name: string]: unknown;
}

const storage = new MemoryStorage();

for (const target of [globalThis, typeof window === "undefined" ? null : window]) {
  if (!target) continue;
  Object.defineProperty(target, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}
