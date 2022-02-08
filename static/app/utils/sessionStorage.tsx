import createLocalStorage from './createStorage';

const Storage = createLocalStorage(() => window.sessionStorage);

export default Storage;
