let functions = {};

try {
  let mod = 'sentry';
  localStorage.setItem(mod, mod);
  localStorage.removeItem(mod);

  functions = {
    setItem: localStorage.setItem.bind(localStorage),
    getItem: localStorage.getItem.bind(localStorage)
  };
} catch(e) {
  functions = {
    setItem() { return; },
    // Returns null if key doesn't exist:
    // https://developer.mozilla.org/en-US/docs/Web/API/Storage/getItem
    getItem() { return null; }
  };
}

export default functions;
