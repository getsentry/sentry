import type {ReactNode} from 'react';

import type {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import type {Event, Frame} from 'sentry/types/event';
import type {
  LineCoverage,
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';

export type FrameBadge = (frame: Frame) => ReactNode;

export type StackTraceView = 'app' | 'full' | 'raw';

export type FrameRow = {
  frame: Frame;
  frameIndex: number;
  hiddenFrameCount: number | undefined;
  isSubFrame: boolean;
  kind: 'frame';
  nextFrame: Frame | undefined;
  timesRepeated: number;
};

export type OmittedFramesRow = {
  kind: 'omitted';
  omittedFrames: [number, number];
  rowKey: string;
};

export type Row = FrameRow | OmittedFramesRow;

export type FrameLineCoverageResolver = (params: {
  event: Event;
  frame: Frame;
  frameIndex: number;
  isMinified: boolean;
  stacktrace: StacktraceType;
}) => LineCoverage[] | undefined;

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
  /** Sentry App integrations that provide "open in X" stacktrace links. */
  components?: Array<SentryAppComponent<SentryAppSchemaStacktraceLink>>;
  /** Show the minified stacktrace by default when minifiedStacktrace is provided. */
  defaultIsMinified?: boolean;
  /** Show newest frame first. */
  defaultIsNewestFirst?: boolean;
  /** Initial view mode. 'app' hides system frames, 'full' shows all, 'raw' shows raw text. */
  defaultView?: StackTraceView;
  /** Render a badge next to a frame row — used to surface ANR suspect frames. */
  frameBadge?: FrameBadge;
  /** Per-frame source map debugger data, powering the "Unminify Code" action. */
  frameSourceMapDebuggerData?: FrameSourceMapDebuggerData[];
  /**
   * Called per frame to get line-level code coverage annotations.
   * Return an array of [lineNo, Coverage] tuples or undefined if not available.
   * Used by Codecov integration to color-code source lines.
   */
  getFrameLineCoverage?: FrameLineCoverageResolver;
  /** Hide the source maps debugger button entirely. */
  hideSourceMapDebugger?: boolean;
  /** Cap the number of frames rendered. Frames beyond this depth are omitted. */
  maxDepth?: number;
  /** Relay PII/scrubbing metadata used to render redaction annotations on frame variables. */
  meta?: StackTraceMeta;
  /** When provided alongside defaultIsMinified, enables toggling between symbolicated and minified views. */
  minifiedStacktrace?: StacktraceType;
  /** Override the platform used for frame rendering logic. Defaults to the event/frame platform. */
  platform?: PlatformKey;
}
