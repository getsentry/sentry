import {createContext, useContext} from 'react';

import type {analyzeNativeFrames} from './nativeFrameAnalysis';

export interface NativeStackTraceContextValue extends ReturnType<
  typeof analyzeNativeFrames
> {
  /** Jumps to Images Loaded; undefined in hover previews or when that section is missing. */
  goToImagesLoaded: ((searchTerm: string | undefined) => void) | undefined;
}

export const NativeStackTraceContext = createContext<NativeStackTraceContextValue | null>(
  null
);

export function useNativeStackTraceContext(): NativeStackTraceContextValue {
  const value = useContext(NativeStackTraceContext);
  if (!value) {
    throw new Error(
      'useNativeStackTraceContext must be used within NativeStackTraceProvider'
    );
  }
  return value;
}
