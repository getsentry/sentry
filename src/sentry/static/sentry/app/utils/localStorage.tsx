interface LocalStorage {
  setItem(key: string, value: string): void;
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

function createLocalStorage(): LocalStorage {
  const localStorage = window.localStorage;
  try {
    const mod = 'sentry';
    localStorage.setItem(mod, mod);
    localStorage.removeItem(mod);

    return {
      setItem: localStorage.setItem.bind(localStorage),
      getItem: localStorage.getItem.bind(localStorage),
      removeItem: localStorage.removeItem.bind(localStorage),
    } as LocalStorage;
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
    } as LocalStorage;
  }
}

const functions = createLocalStorage();

export default functions;
