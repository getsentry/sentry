const localStorageMock = function () {
  let store: Record<string, string | null> = {};
  return {
    getItem: vi.fn((key: any) => store[key]),

    setItem: vi.fn((key: any, value: any) => {
      store[key] = value.toString();
    }),

    removeItem: vi.fn((key: any) => {
      store[key] = null;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
};

export default localStorageMock();
