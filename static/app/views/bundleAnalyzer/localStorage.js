const KEY_PREFIX = 'wba';

const storage = {
  getItem(key) {
    try {
      return JSON.parse(window.localStorage.getItem(`${KEY_PREFIX}.${key}`));
    } catch (err) {
      return null;
    }
  },

  setItem(key, value) {
    try {
      window.localStorage.setItem(`${KEY_PREFIX}.${key}`, JSON.stringify(value));
    } catch (err) {
      /* ignored */
    }
  },

  removeItem(key) {
    try {
      window.localStorage.removeItem(`${KEY_PREFIX}.${key}`);
    } catch (err) {
      /* ignored */
    }
  },
};

export default storage;
