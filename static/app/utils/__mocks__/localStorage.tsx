const localStorageMock = function () {
  let store = {};
  return {
    getItem: jest.fn(key => store[key]),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      store[key] = null;
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
};

export default localStorageMock();
