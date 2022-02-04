import createLocalStorage from './createStorage';

const functions = createLocalStorage(() => window.localStorage);

export default functions;
