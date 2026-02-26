import {createContext, useContext} from 'react';

import type {Event, Frame} from 'sentry/types/event';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';

import type {Row, StackTraceMeta, StackTraceView} from './types';

export interface StackTraceContextValue {
  components: Array<SentryAppComponent<SentryAppSchemaStacktraceLink>>;
  event: Event;
  expandedFrames: Record<number, boolean>;
  frames: Frame[];
  hiddenFrameToggleMap: Record<number, boolean>;
  isNewestFirst: boolean;
  lastFrameIndex: number;
  meta: StackTraceMeta | undefined;
  platform: PlatformKey;
  rows: Row[];
  setIsNewestFirst: React.Dispatch<React.SetStateAction<boolean>>;
  setView: React.Dispatch<React.SetStateAction<StackTraceView>>;
  stacktrace: StacktraceType;
  toggleFrameExpansion: (frameIndex: number) => void;
  toggleHiddenFrames: (frameIndex: number) => void;
  view: StackTraceView;
}

export interface StackTraceFrameContextValue {
  event: Event;
  frame: Frame;
  frameIndex: number;
  hiddenFrameCount: number | undefined;
  hiddenFramesExpanded: boolean;
  isExpandable: boolean;
  isExpanded: boolean;
  nextFrame: Frame | undefined;
  platform: PlatformKey;
  timesRepeated: number;
  toggleExpansion: () => void;
  toggleHiddenFrames: () => void;
}

export const StackTraceContext = createContext<StackTraceContextValue | null>(null);
export const StackTraceFrameContext = createContext<StackTraceFrameContextValue | null>(
  null
);

export function useStackTraceContext() {
  const context = useContext(StackTraceContext);
  if (!context) {
    throw new Error('StackTrace components must be used within StackTrace.Root');
  }
  return context;
}

export function useStackTraceFrameContext() {
  const context = useContext(StackTraceFrameContext);
  if (!context) {
    throw new Error('StackTrace.Frame components must be used within StackTrace.Frame');
  }
  return context;
}
