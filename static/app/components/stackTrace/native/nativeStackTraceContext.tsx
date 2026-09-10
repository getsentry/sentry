import {createContext, useContext} from 'react';

import type {analyzeNativeFrames} from './nativeFrameAnalysis';

export interface NativeStackTraceContextValue extends ReturnType<
  typeof analyzeNativeFrames
> {
  /** Hover previews delay tooltips and disable navigation. */
  isHoverPreviewed: boolean;
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
