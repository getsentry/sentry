import {createContext, useContext} from 'react';

import type {OmniSearchConfig, OmniSearchStore} from './types';

export const OmniConfigContext = createContext<OmniSearchConfig | null>(null);
export const OmniSearchStoreContext = createContext<OmniSearchStore | null>(null);

export function useOmniSearchConfiguration(): OmniSearchConfig {
  const ctx = useContext(OmniConfigContext);
  if (ctx === null) {
    throw new Error('OmniSearchProvider is not in context');
  }
  return ctx;
}

export function useOmniSearchStore(): OmniSearchStore {
  const ctx = useContext(OmniSearchStoreContext);
  if (ctx === null) {
    throw new Error('OmniSearchProvider is not in context');
  }
  return ctx;
}
