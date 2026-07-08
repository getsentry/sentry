import {createContext, useContext} from 'react';

import type {DO_NOT_USE_ButtonProps as ButtonProps} from './button/types';

const TrackingContext = createContext<() => (props: ButtonProps) => void>(() => () => {});

export const TrackingContextProvider = TrackingContext.Provider;

export const useButtonTracking = () => {
  return useContext(TrackingContext)();
};
