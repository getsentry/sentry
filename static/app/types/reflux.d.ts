import {SafeRefluxStore, SafeStoreDefinition} from 'sentry/utils/makeSafeRefluxStore';
import {Store, StoreDefinition} from 'reflux';

declare module 'reflux' {
  function createStore<T extends SafeStoreDefinition | StoreDefinition>(
    storeDefinition: T
  ): Store & T;
}
