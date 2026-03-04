// Window/localStorage shims for SSR — must run before any component imports.
//
// IMPORTANT: Do NOT define globalThis.document here. Emotion's SSR style
// extraction checks `typeof document !== 'undefined'` at module load time to
// decide between server (sync) and browser (useInsertionEffect) code paths.
// If document is defined, Emotion uses useInsertionEffect which doesn't fire
// during renderToString, and CSS extraction silently produces empty styles.
if (typeof globalThis.window === 'undefined') {
  const makeStorage = () => {
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
  };

  const localStorageShim = makeStorage();

  globalThis.window = {
    localStorage: localStorageShim,
    sessionStorage: makeStorage(),
    location: {href: '', pathname: '/', search: '', hash: ''},
    navigator: {userAgent: ''},
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({matches: false, addListener: () => {}, removeListener: () => {}}),
    getComputedStyle: () => ({}),
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  } as any;

  globalThis.localStorage = localStorageShim as unknown as Storage;
}
