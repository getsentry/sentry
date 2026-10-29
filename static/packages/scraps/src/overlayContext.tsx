import type * as React from 'react';
import {createContext, useContext} from 'react';

export interface DrawerLocation {
  pathname: string;
  query: Record<string, string | string[] | null | undefined>;
  hash?: string;
  search?: string;
}

export interface DrawerWidthStorage {
  get: (key: string) => number | undefined;
  set: (key: string, widthPercent: number) => void;
  subscribe: (key: string, listener: () => void) => () => void;
}

export interface OverlayContextValue {
  /** Offset below app chrome for left and passive panels. */
  contentTop?: string;
  drawer?: {
    boundaryComponent?: React.ComponentType<React.PropsWithChildren>;
    location?: DrawerLocation;
    shouldCloseOnInteractOutside?: (element: Element) => boolean;
    widthStorage?: DrawerWidthStorage;
  };
  headerHeight?: string;
  isSmallScreen?: boolean;
}

const OverlayContext = createContext<OverlayContextValue>({});

export const OverlayContextProvider = OverlayContext.Provider;

export function useOverlayContext() {
  return useContext(OverlayContext);
}
