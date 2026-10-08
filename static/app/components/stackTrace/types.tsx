import type {ReactNode} from 'react';

import type {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import type {StackTraceRowPolicy} from 'sentry/components/stackTrace/rowPolicy';
import type {Event, Frame, Thread} from 'sentry/types/event';
import type {Meta} from 'sentry/types/group';
import type {PlatformKey} from 'sentry/types/platform';
import type {StacktraceType} from 'sentry/types/stacktrace';

export type StackTraceView = 'app' | 'full' | 'raw';

export interface StackTraceViewState {
  hasMinifiedStacktrace: boolean;
  isMinified: boolean;
  isNewestFirst: boolean;
  setIsMinified: (isMinified: boolean) => void;
  setIsNewestFirst: (isNewestFirst: boolean) => void;
  setView: (view: StackTraceView) => void;
  view: StackTraceView;
  platform?: PlatformKey;
}

export interface StackTraceViewStateProviderProps {
  children: ReactNode;
  defaultIsMinified?: boolean;
  defaultIsNewestFirst?: boolean;
  defaultView?: StackTraceView;
  hasMinifiedStacktrace?: boolean;
  platform?: PlatformKey;
}

export type FrameRow = {
  frame: Frame;
  frameIndex: number;
  isSubFrame: boolean;
  isUsedForGrouping: boolean;
  kind: 'frame';
  timesRepeated: number;
  hiddenFrameCount?: number;
  nextFrame?: Frame;
};

export type OmittedFramesRow = {
  kind: 'omitted';
  omittedFrames: [number, number];
  rowKey: string;
};

export type Row = FrameRow | OmittedFramesRow;

export interface StackTraceFrameHeaderProps {
  /** Custom trailing actions, optionally resolved with the header's hover state. */
  actions?: ReactNode | ((props: {isHovering: boolean}) => ReactNode);
}

export interface StackTraceFrameMeta {
  function?: Record<string, Partial<Meta>>;
  rawFunction?: Record<string, Partial<Meta>>;
  vars?: Record<string, unknown>;
}

export interface StackTraceMeta {
  frames?: Record<number, StackTraceFrameMeta>;
  registers?: Record<string, unknown>;
}

export interface StackTraceProviderProps {
  children: ReactNode;
  event: Event;
  stacktrace: StacktraceType | null;
  /** When true, all frames start collapsed regardless of their position. */
  collapseAll?: boolean;
  /** Frame index to expand by default. Null means no default-expanded frame. */
  defaultExpandedFrameIndex?: number | null;
  /** Allows a single frame with no context/register details to be expanded. */
  emptySourceNotation?: boolean;
  /** Optional exception index in the full exception values list. */
  exceptionIndex?: number;
  /** Per-frame source map debugger data, powering the "Unminify Code" action. */
  frameSourceMapDebuggerData?: FrameSourceMapDebuggerData[];
  /** Whether the SCM source context feature is enabled for this org. */
  hasScmSourceContext?: boolean;
  /** Hide the source maps debugger button entirely. */
  hideSourceMapDebugger?: boolean;
  lockAddress?: string;
  /** Cap the number of frames rendered. Frames beyond this depth are omitted. */
  maxDepth?: number;
  /** Relay PII/scrubbing metadata used to render redaction annotations on frame variables. */
  meta?: StackTraceMeta;
  /**
   * Enables toggling between symbolicated and minified views when present.
   * The initial minified selection is controlled by StackTraceViewStateProvider.
   */
  minifiedStacktrace?: StacktraceType;
  /** Override the platform used for frame rendering logic. Defaults to the event/frame platform. */
  platform?: PlatformKey;
  /** Row visibility and annotation policy for stacktrace-specific frame behavior. */
  rowPolicy?: StackTraceRowPolicy;
  thread?: Thread;
}
