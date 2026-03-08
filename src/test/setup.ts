import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

if (
  !("localStorage" in globalThis) ||
  typeof globalThis.localStorage?.getItem !== "function"
) {
  const store = new Map<string, string>();

  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
    configurable: true,
  });
}
