import {createContext, useContext} from 'react';

import {OmniSearchConfig, OmniSearchStore} from './types';

/**
 * Represents the configuration context used to register / unregister actions
 * within the omni search
 */
export const OmniConfigContext = createContext<OmniSearchConfig | null>(null);

export function useOmniSearchConfiguration() {
  const config = useContext(OmniConfigContext);

  if (config === null) {
    throw new Error('OmniSearchProvider is not in context');
  }

  return config;
}

/**
 * Represents all registered actions within the OmniSearch
 */
export const OmniSearchStoreContext = createContext<OmniSearchStore | null>(null);

export function useOmniSearchStore() {
  const store = useContext(OmniSearchStoreContext);

  if (store === null) {
    throw new Error('OmniSearchProvider is not in context');
  }

  return store;
}
