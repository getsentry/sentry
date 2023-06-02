import type {Breadcrumb, FetchBreadcrumbData, XhrBreadcrumbData} from '@sentry/types';
import type {EventType} from '@sentry-internal/rrweb/typings/types';

import type {AllEntryData} from './performance';

interface BaseReplayFrame {
  category: string;
  timestamp: number;
  /**
   * For compatibility reasons
   */
  type: string;
  data?: Record<string, any>;
  message?: string;
}

interface BaseDomFrameData {
  node?: {
    attributes: Record<string, any>;
    id: number;
    tagName: string;
    textContent: string;
  };
  nodeId?: number;
}

/* Breadcrumbs from Core SDK */
interface ConsoleFrameData {
  logger: string;
  arguments?: unknown[];
}
interface ConsoleFrame extends BaseReplayFrame {
  category: 'console';
  data: ConsoleFrameData;
  level: Breadcrumb['level'];
  message: string;
}

type ClickFrameData = BaseDomFrameData;
interface ClickFrame extends BaseReplayFrame {
  category: 'ui.click';
  data: ClickFrameData;
  message: string;
}

interface FetchFrame extends BaseReplayFrame {
  category: 'fetch';
  data: FetchBreadcrumbData;
  type: 'http';
}

interface InputFrame extends BaseReplayFrame {
  category: 'ui.input';
  message: string;
}

interface XhrFrame extends BaseReplayFrame {
  category: 'xhr';
  data: XhrBreadcrumbData;
  type: 'http';
}

/* Breadcrumbs from Replay */
interface MutationFrameData {
  count: number;
  limit: boolean;
}
interface MutationFrame extends BaseReplayFrame {
  category: 'replay.mutations';
  data: MutationFrameData;
}

interface KeyboardEventFrameData extends BaseDomFrameData {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}
interface KeyboardEventFrame extends BaseReplayFrame {
  category: 'ui.keyDown';
  data: KeyboardEventFrameData;
}

interface BlurFrame extends BaseReplayFrame {
  category: 'ui.blur';
}

interface FocusFrame extends BaseReplayFrame {
  category: 'ui.focus';
}

interface SlowClickFrameData extends ClickFrameData {
  endReason: string;
  timeAfterClickFs: number;
  url: string;
}
interface SlowClickFrame extends BaseReplayFrame {
  category: 'ui.slowClickDetected';
  data: SlowClickFrameData;
}

interface OptionFrame {
  blockAllMedia: boolean;
  errorSampleRate: number;
  maskAllInputs: boolean;
  maskAllText: boolean;
  networkCaptureBodies: boolean;
  networkDetailHasUrls: boolean;
  networkRequestHasHeaders: boolean;
  networkResponseHasHeaders: boolean;
  sessionSampleRate: number;
  useCompression: boolean;
  useCompressionOption: boolean;
}

export type BreadcrumbFrame =
  | ConsoleFrame
  | ClickFrame
  | FetchFrame
  | InputFrame
  | XhrFrame
  | KeyboardEventFrame
  | BlurFrame
  | FocusFrame
  | SlowClickFrame
  | MutationFrame
  | BaseReplayFrame;

export interface SpanFrame {
  data: AllEntryData;
  description: string;
  endTimestamp: number;
  op: string;
  startTimestamp: number;
}

export type ReplayFrame = BreadcrumbFrame | SpanFrame;

interface RecordingCustomEvent {
  data: {
    payload: unknown;
    tag: string;
  };
  timestamp: number;
  type: EventType.Custom;
}

export interface BreadcrumbFrameEvent extends RecordingCustomEvent {
  data: {
    payload: BreadcrumbFrame;
    tag: 'breadcrumb';
    /**
     * This will indicate to backend to additionally log as a metric
     */
    metric?: boolean;
  };
}

export interface SpanFrameEvent extends RecordingCustomEvent {
  data: {
    payload: SpanFrame;
    tag: 'performanceSpan';
  };
}

export interface OptionFrameEvent extends RecordingCustomEvent {
  data: {
    payload: OptionFrame;
    tag: 'options';
  };
}

export type ReplayFrameEvent = BreadcrumbFrameEvent | SpanFrameEvent | OptionFrameEvent;
