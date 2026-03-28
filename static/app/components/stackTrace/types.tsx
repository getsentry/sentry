import type {ReactNode} from 'react';

import type {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import type {Event, Frame} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';

export type StackTraceView = 'app' | 'full' | 'raw';

export interface StackTraceViewState {
  hasMinifiedStacktrace: boolean;
  isMinified: boolean;
  isNewestFirst: boolean;
  setIsMinified: React.Dispatch<React.SetStateAction<boolean>>;
  setIsNewestFirst: React.Dispatch<React.SetStateAction<boolean>>;
  setView: React.Dispatch<React.SetStateAction<StackTraceView>>;
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

export type StackTraceMeta = {
  frames?: Array<{
    vars?: Record<string, unknown>;
  }>;
  registers?: Record<string, unknown>;
} & Record<string, unknown>;

export interface StackTraceProviderProps {
  children: ReactNode;
  event: Event;
  stacktrace: StacktraceType;
  /** Optional exception index in the full exception values list. */
  exceptionIndex?: number;
  /** Per-frame source map debugger data, powering the "Unminify Code" action. */
  frameSourceMapDebuggerData?: FrameSourceMapDebuggerData[];
  /** Whether the SCM source context feature is enabled for this org. */
  hasScmSourceContext?: boolean;
  /** Hide the source maps debugger button entirely. */
  hideSourceMapDebugger?: boolean;
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
}
