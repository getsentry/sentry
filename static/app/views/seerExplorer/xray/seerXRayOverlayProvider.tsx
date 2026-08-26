import {Fragment} from 'react';

import {SeerXRayOverlay} from './seerXRayOverlay';

interface SeerXRayOverlayProviderProps {
  children: NonNullable<React.ReactNode>;
}

/**
 * Slots `SeerXRayOverlay` alongside the app tree — matching the `{children}`
 * shape `AppProviders` composes, even though this doesn't provide a context
 * itself. Must render inside `LLMContextProvider`, since the overlay reads
 * from it via `useLLMContextRegistry`.
 */
export function SeerXRayOverlayProvider({children}: SeerXRayOverlayProviderProps) {
  return (
    <Fragment>
      {children}
      <SeerXRayOverlay />
    </Fragment>
  );
}
