import {createContext, useContext} from 'react';

import type {BlockRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';

export const RendererContext = createContext<
  | undefined
  | {
      renderer: BlockRenderer;
    }
>(undefined);

export const useRendererContext = () => {
  const context = useContext(RendererContext);
  if (!context) {
    throw new Error('useRendererContext must be used within a RendererContext');
  }
  return context;
};
