import type {
  SafeRefluxStore,
  SafeStoreDefinition,
} from 'sentry/utils/makeSafeRefluxStore';
import type {Store, StoreDefinition} from 'reflux';

declare module 'reflux' {
  function createStore<T extends SafeStoreDefinition | StoreDefinition>(
    storeDefinition: T
  ): Store & T;
}
