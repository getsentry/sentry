import {createStorage} from './createStorage';

export const localStorageWrapper = createStorage(() => window.localStorage);
