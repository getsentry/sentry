// our storage wrapper is a subset of the full API
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export default function createStorage(getStorage: () => globalThis.Storage): Storage {
  try {
    const storage = getStorage();
    const mod = 'sentry';
    storage.setItem(mod, mod);
    storage.removeItem(mod);

    return {
      setItem: storage.setItem.bind(storage),
      getItem: storage.getItem.bind(storage),
      removeItem: storage.removeItem.bind(storage),
    } as Storage;
  } catch (e) {
    return {
      setItem() {
        return;
      },
      // Returns null if key doesn't exist:
      // https://developer.mozilla.org/en-US/docs/Web/API/Storage/getItem
      getItem() {
        return null;
      },
      removeItem() {
        return null;
      },
    };
  }
}
