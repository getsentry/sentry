import {createStorage} from './createStorage';

export const localStorageWrapper = createStorage(() => globalThis.localStorage);
