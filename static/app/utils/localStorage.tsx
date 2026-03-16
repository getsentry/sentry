import {createStorage} from './createStorage';

const Storage = createStorage(() => window.localStorage);

export default Storage;
