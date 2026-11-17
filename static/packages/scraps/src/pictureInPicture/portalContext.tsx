import {createContext, type ReactNode} from 'react';

export const PictureInPicturePortalContext = createContext<
  ((pipWindow: Window) => ReactNode) | undefined
>(undefined);
