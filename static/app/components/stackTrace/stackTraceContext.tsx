import {createContext, useContext, useMemo, useState} from 'react';

import type {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import type {Event, Frame} from 'sentry/types/event';
import type {PlatformKey, Project} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';

import type {
  Row,
  StackTraceMeta,
  StackTraceView,
  StackTraceViewState,
  StackTraceViewStateProviderProps,
} from './types';

const StackTraceViewStateContext = createContext<StackTraceViewState | null>(null);

export function StackTraceViewStateProvider({
  children,
  defaultIsMinified = false,
  defaultIsNewestFirst = true,
  defaultView = 'app',
  hasMinifiedStacktrace = false,
  platform,
}: StackTraceViewStateProviderProps) {
  const [view, setView] = useState<StackTraceView>(defaultView);
  const [isNewestFirst, setIsNewestFirst] = useState(defaultIsNewestFirst);
  const [isMinified, setIsMinified] = useState(
    hasMinifiedStacktrace && defaultIsMinified
  );

  const value = useMemo<StackTraceViewState>(
    () => ({
      hasMinifiedStacktrace,
      isMinified,
      isNewestFirst,
      platform,
      setIsMinified,
      setIsNewestFirst,
      setView,
      view,
    }),
    [hasMinifiedStacktrace, isMinified, isNewestFirst, platform, view]
  );

  return (
    <StackTraceViewStateContext.Provider value={value}>
      {children}
    </StackTraceViewStateContext.Provider>
  );
}

export interface StackTraceContextValue {
  /** All frames regardless of system-frame filter, for Activity-based rendering. */
  allRows: Row[];
  /** Event payload for project/platform metadata and integrations. */
  event: Event;
  /** Active frame list for the selected (symbolicated/minified) stacktrace. */
  frames: Frame[];
  /** True when any visible frame row has expandable details. */
  hasAnyExpandableFrames: boolean;
  /** Hidden-system-frame expansion state keyed by frame index. */
  hiddenFrameToggleMap: Record<number, boolean>;
  /** True when the "Unminify Code" source map action must be hidden. */
  hideSourceMapDebugger: boolean;
  /** Last in-app frame index, or the final frame index when none are in-app. */
  lastFrameIndex: number;
  /** Rendering platform for frame utils; always resolved before context creation. */
  platform: PlatformKey;
  /** Materialized rows (frames + omitted markers) for rendering. */
  rows: Row[];
  /** Currently active stacktrace (symbolicated or minified). */
  stacktrace: StacktraceType;
  /** Toggles hidden system frames adjacent to a visible row. */
  toggleHiddenFrames: (frameIndex: number) => void;
  /** Optional exception index in the full exception values list. */
  exceptionIndex?: number;
  /** Optional per-frame source map debugger resolution data. */
  frameSourceMapDebuggerData?: FrameSourceMapDebuggerData[];
  /** Optional redaction metadata used by variable/register renderers. */
  meta?: StackTraceMeta;
  /** Active project from ProjectsStore, used by frame source-link actions. */
  project?: Project;
}

export interface StackTraceFrameContextValue {
  /** Event payload for links, integrations, and analytics in frame actions. */
  event: Event;
  /** Current frame row data. Always defined for StackTrace.Frame descendants. */
  frame: Frame;
  /** Stable DOM id for aria-controls links between header and context. */
  frameContextId: string;
  /** Absolute frame index within stacktrace.frames. */
  frameIndex: number;
  /** Expanded/collapsed state for hidden system frames near this row. */
  hiddenFramesExpanded: boolean;
  /** Whether this row has expandable source/register/context details. */
  isExpandable: boolean;
  /** Whether source/register/context details are currently expanded. */
  isExpanded: boolean;
  /** Effective platform used for frame render/utility logic. */
  platform: PlatformKey;
  /** Number of repeated frames collapsed into this row. */
  timesRepeated: number;
  /** Toggle handler for source/register/context expansion. */
  toggleExpansion: () => void;
  /** Toggle handler for revealing or hiding collapsed system frames. */
  toggleHiddenFrames: () => void;
  /** Count of collapsed system frames hidden behind this row, when present. */
  hiddenFrameCount?: number;
  /** Next frame in call order, when one exists. */
  nextFrame?: Frame;
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

export function useStackTraceViewState(): StackTraceViewState {
  const context = useContext(StackTraceViewStateContext);
  if (!context) {
    throw new Error(
      'useStackTraceViewState must be used within StackTraceViewStateProvider'
    );
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
