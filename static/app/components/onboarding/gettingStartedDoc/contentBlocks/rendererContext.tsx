import {createContext, useContext} from 'react';

import type {BlockRenderers} from './types';

export const RendererContext = createContext<
  | undefined
  | {
      renderers: BlockRenderers;
    }
>(undefined);

export const useRendererContext = () => {
  const context = useContext(RendererContext);
  if (!context) {
    throw new Error('useRendererContext must be used within a RendererContext');
  }
  return context;
};
