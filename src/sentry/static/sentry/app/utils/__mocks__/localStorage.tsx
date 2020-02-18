const localStorageMock = function() {
  let store = {};
  return {
    getItem: jest.fn(key => {
      return store[key];
    }),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
};

export default localStorageMock();
