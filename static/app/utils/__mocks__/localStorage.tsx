const localStorageMock = function () {
  let store: Record<string, string | null> = {};
  return {
    getItem: jest.fn((key: any) => store[key]),

    setItem: jest.fn((key: any, value: any) => {
      store[key] = value.toString();
    }),

    removeItem: jest.fn((key: any) => {
      store[key] = null;
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
};

export default localStorageMock();
