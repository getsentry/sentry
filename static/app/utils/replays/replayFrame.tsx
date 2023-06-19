import type {Breadcrumb} from '@sentry/types';
import type {EventType} from '@sentry-internal/rrweb';

import type {
  HistoryData,
  LargestContentfulPaintData,
  MemoryData,
  NavigationData,
  NetworkRequestData,
  PaintData,
  ResourceData,
} from './performance';

interface BaseBreadcrumbFrame {
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
interface ConsoleFrame extends BaseBreadcrumbFrame {
  category: 'console';
  data: ConsoleFrameData;
  level: Breadcrumb['level'];
  message: string;
}

type ClickFrameData = BaseDomFrameData;
interface ClickFrame extends BaseBreadcrumbFrame {
  category: 'ui.click';
  data: ClickFrameData;
  message: string;
}

interface InputFrame extends BaseBreadcrumbFrame {
  category: 'ui.input';
  message: string;
}

/* Breadcrumbs from Replay */
interface MutationFrameData {
  count: number;
  limit: boolean;
}
interface MutationFrame extends BaseBreadcrumbFrame {
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
interface KeyboardEventFrame extends BaseBreadcrumbFrame {
  category: 'ui.keyDown';
  data: KeyboardEventFrameData;
}

interface BlurFrame extends BaseBreadcrumbFrame {
  category: 'ui.blur';
}

interface FocusFrame extends BaseBreadcrumbFrame {
  category: 'ui.focus';
}

interface SlowClickFrameData extends ClickFrameData {
  endReason: string;
  timeAfterClickMs: number;
  url: string;
}
interface SlowClickFrame extends BaseBreadcrumbFrame {
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
  | InputFrame
  | KeyboardEventFrame
  | BlurFrame
  | FocusFrame
  | SlowClickFrame
  | MutationFrame
  | BaseBreadcrumbFrame;

interface BaseSpanFrame {
  description: string;
  endTimestamp: number;
  op: string;
  startTimestamp: number;
  data?: undefined | Record<string, any>;
}

interface HistoryFrame extends BaseSpanFrame {
  data: HistoryData;
  op: 'navigation.push';
}

interface LargestContentfulPaintFrame extends BaseSpanFrame {
  data: LargestContentfulPaintData;
  op: 'largest-contentful-paint';
}

interface MemoryFrame extends BaseSpanFrame {
  data: MemoryData;
  op: 'memory';
}

interface NavigationFrame extends BaseSpanFrame {
  data: NavigationData;
  op: 'navigation.navigate' | 'navigation.reload' | 'navigation.back_forward';
}

interface PaintFrame extends BaseSpanFrame {
  data: PaintData;
  op: 'paint';
}

interface RequestFrame extends BaseSpanFrame {
  data: NetworkRequestData;
  op: 'resource.fetch' | 'resource.xhr';
}

interface ResourceFrame extends BaseSpanFrame {
  data: ResourceData;
  op:
    | 'resource.css'
    | 'resource.iframe'
    | 'resource.img'
    | 'resource.link'
    | 'resource.other'
    | 'resource.script';
}

export type SpanFrame =
  | BaseSpanFrame
  | HistoryFrame
  | LargestContentfulPaintFrame
  | MemoryFrame
  | NavigationFrame
  | PaintFrame
  | RequestFrame
  | ResourceFrame;

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
