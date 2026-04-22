import {createStorage} from './createStorage';

export const sessionStorageWrapper = createStorage(() => globalThis.sessionStorage);
