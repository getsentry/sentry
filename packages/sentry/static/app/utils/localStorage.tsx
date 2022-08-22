import createLocalStorage from './createStorage';

const Storage = createLocalStorage(() => window.localStorage);

export default Storage;
