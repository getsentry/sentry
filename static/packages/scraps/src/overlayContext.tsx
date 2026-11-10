import type * as React from 'react';
import {createContext, useContext} from 'react';

import type {ModalBoundaryProps} from './modal/types';

export interface OverlayLocation {
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
    widthStorage?: DrawerWidthStorage;
  };
  headerHeight?: string;
  location?: OverlayLocation;
  modal?: {
    boundaryComponent?: React.ComponentType<ModalBoundaryProps>;
    getAppElement?: () => HTMLElement | null;
  };
}

const OverlayContext = createContext<OverlayContextValue>({});

export const OverlayContextProvider = OverlayContext.Provider;

export function useOverlayContext() {
  return useContext(OverlayContext);
}
