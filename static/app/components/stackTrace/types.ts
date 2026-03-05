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
  components?: Array<SentryAppComponent<SentryAppSchemaStacktraceLink>>;
  defaultIsMinified?: boolean;
  defaultIsNewestFirst?: boolean;
  defaultView?: StackTraceView;
  frameBadge?: FrameBadge;
  frameSourceMapDebuggerData?: FrameSourceMapDebuggerData[];
  getFrameLineCoverage?: FrameLineCoverageResolver;
  hideSourceMapDebugger?: boolean;
  maxDepth?: number;
  meta?: StackTraceMeta;
  minifiedStacktrace?: StacktraceType;
  platform?: PlatformKey;
}
