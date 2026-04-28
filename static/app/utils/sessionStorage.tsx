import {createStorage} from './createStorage';

export const sessionStorageWrapper = createStorage(() => window.sessionStorage);
