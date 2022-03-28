import {StoreDefinition, Store} from 'reflux';

declare module 'reflux' {
  export function createStore(definition: StoreDefinition): Store | null;
}
