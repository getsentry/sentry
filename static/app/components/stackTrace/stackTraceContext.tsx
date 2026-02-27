import {createContext, useContext} from 'react';

import type {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import type {Event, Frame} from 'sentry/types/event';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';

import type {
  FrameLineCoverageResolver,
  Row,
  StackTraceMeta,
  StackTraceView,
} from './types';

export interface StackTraceSharedViewContextValue {
  hasMinifiedStacktrace: boolean;
  isMinified: boolean;
  isNewestFirst: boolean;
  setIsMinified: React.Dispatch<React.SetStateAction<boolean>>;
  setIsNewestFirst: React.Dispatch<React.SetStateAction<boolean>>;
  setView: React.Dispatch<React.SetStateAction<StackTraceView>>;
  view: StackTraceView;
}

export const StackTraceSharedViewContext =
  createContext<StackTraceSharedViewContextValue | null>(null);

export interface StackTraceContextValue {
  components: Array<SentryAppComponent<SentryAppSchemaStacktraceLink>>;
  event: Event;
  expandedFrames: Record<number, boolean>;
  frameSourceMapDebuggerData: FrameSourceMapDebuggerData[] | undefined;
  frames: Frame[];
  getFrameLineCoverage: FrameLineCoverageResolver | undefined;
  hasMinifiedStacktrace: boolean;
  hiddenFrameToggleMap: Record<number, boolean>;
  hideSourceMapDebugger: boolean;
  isMinified: boolean;
  isNewestFirst: boolean;
  lastFrameIndex: number;
  lockAddress: string | undefined;
  meta: StackTraceMeta | undefined;
  platform: PlatformKey;
  rows: Row[];
  setIsMinified: React.Dispatch<React.SetStateAction<boolean>>;
  setIsNewestFirst: React.Dispatch<React.SetStateAction<boolean>>;
  setView: React.Dispatch<React.SetStateAction<StackTraceView>>;
  stacktrace: StacktraceType;
  threadId: number | undefined;
  toggleFrameExpansion: (frameIndex: number) => void;
  toggleHiddenFrames: (frameIndex: number) => void;
  view: StackTraceView;
}

export interface StackTraceFrameContextValue {
  event: Event;
  frame: Frame;
  frameContextId: string;
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

export function useOptionalStackTraceContext() {
  return useContext(StackTraceContext);
}

export function useStackTraceFrameContext() {
  const context = useContext(StackTraceFrameContext);
  if (!context) {
    throw new Error('StackTrace.Frame components must be used within StackTrace.Frame');
  }
  return context;
}
