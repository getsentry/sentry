import {createStorage} from './createStorage';

const Storage = createStorage(() => window.sessionStorage);

export default Storage;
