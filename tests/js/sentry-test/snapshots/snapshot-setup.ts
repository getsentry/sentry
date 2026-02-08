// Provide minimal browser global shims for SSR.
// Some components access window/localStorage at module scope or during render.
//
// IMPORTANT: Do NOT define globalThis.document here. Emotion's SSR style
// extraction checks `typeof document !== 'undefined'` at module load time to
// decide between server (sync) and browser (useInsertionEffect) code paths.
// If document is defined, Emotion uses useInsertionEffect which doesn't fire
// during renderToString, and CSS extraction silently produces empty styles.
if (typeof globalThis.window === 'undefined') {
  function makeStorageShim() {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (_index: number) => null,
    };
  }

  const localStorageShim = makeStorageShim();
  const sessionStorageShim = makeStorageShim();

  // @ts-expect-error - Intentional minimal shim for SSR
  globalThis.window = {
    localStorage: localStorageShim,
    sessionStorage: sessionStorageShim,
    location: {href: '', pathname: '/', search: '', hash: ''},
    navigator: {userAgent: ''},
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({matches: false, addListener: () => {}, removeListener: () => {}}),
    getComputedStyle: () => ({}),
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };

  globalThis.localStorage = localStorageShim as unknown as Storage;
}

// Suppress React SSR useLayoutEffect warnings
const originalConsoleError = console.error; // eslint-disable-line no-console
// eslint-disable-next-line no-console
console.error = (...args: unknown[]) => {
  const message = typeof args[0] === 'string' ? args[0] : '';
  if (message.includes('useLayoutEffect does nothing on the server')) {
    return;
  }
  originalConsoleError.apply(console, args);
};
