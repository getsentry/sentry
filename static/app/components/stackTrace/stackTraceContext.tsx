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

/**
 * Isolated hover context for the frame header. Kept separate from
 * StackTraceFrameContext so that hover state changes only re-render
 * the lightweight action components that actually need it, not every
 * frame context consumer.
 */
export interface StackTraceFrameHoverContextValue {
  isHovering: boolean;
}

export const StackTraceContext = createContext<StackTraceContextValue | null>(null);
export const StackTraceFrameContext = createContext<StackTraceFrameContextValue | null>(
  null
);
export const StackTraceFrameHoverContext =
  createContext<StackTraceFrameHoverContextValue>({isHovering: false});

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

/**
 * Reads the shared view-state fields from whichever context is available —
 * StackTraceSharedViewContext takes priority, then StackTraceContext.
 * Throws if neither is present, since toolbar components always live inside one of them.
 */
export function useStackTraceViewState(): StackTraceSharedViewContextValue {
  const sharedView = useContext(StackTraceSharedViewContext);
  const ctx = useContext(StackTraceContext);
  const source = sharedView ?? ctx;

  if (!source) {
    throw new Error(
      'useStackTraceViewState must be used within StackTraceSharedViewProvider or StackTraceProvider'
    );
  }

  return {
    view: source.view,
    setView: source.setView,
    hasMinifiedStacktrace: source.hasMinifiedStacktrace,
    isMinified: source.isMinified,
    setIsMinified: source.setIsMinified,
    isNewestFirst: source.isNewestFirst,
    setIsNewestFirst: source.setIsNewestFirst,
  };
}

export function useStackTraceFrameContext() {
  const context = useContext(StackTraceFrameContext);
  if (!context) {
    throw new Error('StackTrace.Frame components must be used within StackTrace.Frame');
  }
  return context;
}

export function useStackTraceFrameHoverContext() {
  return useContext(StackTraceFrameHoverContext);
}
