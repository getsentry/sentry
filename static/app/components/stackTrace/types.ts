import type {ReactNode} from 'react';

import type {Event, Frame} from 'sentry/types/event';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';

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

export type StackTraceMeta = {
  frames?: Array<{
    vars?: Record<string, unknown>;
  }>;
  registers?: Record<string, unknown>;
} & Record<string, unknown>;

export interface StackTraceRootProps {
  children: ReactNode;
  event: Event;
  stacktrace: StacktraceType;
  components?: Array<SentryAppComponent<SentryAppSchemaStacktraceLink>>;
  defaultIsNewestFirst?: boolean;
  defaultView?: StackTraceView;
  maxDepth?: number;
  meta?: StackTraceMeta;
  platform?: PlatformKey;
}
