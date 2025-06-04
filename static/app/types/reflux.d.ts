import type {Store, StoreDefinition} from 'reflux';

type RemoveIndex<T> = {
  [P in keyof T as string extends P ? never : P]: T[P];
};

declare module 'reflux' {
  function createStore<T extends StoreDefinition>(
    storeDefinition: T
  ): RemoveIndex<Store & T>;
}
