import type {
  RawSpanType,
  TraceContextType,
} from 'sentry/components/events/interfaces/spans/types';
import type {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import type {PlatformKey} from 'sentry/data/platformCategories';
import type {IssueType} from 'sentry/types';

import type {RawCrumb} from './breadcrumbs';
import type {Image} from './debugImage';
import type {IssueAttachment, IssueCategory} from './group';
import type {Release} from './release';
import type {RawStacktrace, StackTraceMechanism, StacktraceType} from './stacktrace';
// TODO(epurkhiser): objc and cocoa should almost definitely be moved into PlatformKey
export type PlatformType = PlatformKey | 'objc' | 'cocoa';

export type Level = 'error' | 'fatal' | 'info' | 'warning' | 'sample' | 'unknown';

/**
 * Grouping Configuration.
 */
export type EventGroupComponent = {
  contributes: boolean;
  hint: string | null;
  id: string;
  name: string | null;
  values: EventGroupComponent[] | string[];
};
export type EventGroupingConfig = {
  base: string | null;
  changelog: string;
  delegates: string[];
  hidden: boolean;
  id: string;
  latest: boolean;
  risk: number;
  strategies: string[];
};

export type VariantEvidence = {
  desc: string;
  fingerprint: string;
  cause_span_hashes?: string[];
  offender_span_hashes?: string[];
  op?: string;
  parent_span_hashes?: string[];
};

type EventGroupVariantKey = 'custom-fingerprint' | 'app' | 'default' | 'system';

export enum EventGroupVariantType {
  CHECKSUM = 'checksum',
  FALLBACK = 'fallback',
  CUSTOM_FINGERPRINT = 'custom-fingerprint',
  COMPONENT = 'component',
  SALTED_COMPONENT = 'salted-component',
  PERFORMANCE_PROBLEM = 'performance-problem',
}

interface BaseVariant {
  description: string | null;
  hash: string | null;
  hashMismatch: boolean;
  key: string;
  type: string;
}

interface FallbackVariant extends BaseVariant {
  type: EventGroupVariantType.FALLBACK;
}

interface ChecksumVariant extends BaseVariant {
  type: EventGroupVariantType.CHECKSUM;
}

interface HasComponentGrouping {
  client_values?: Array<string>;
  component?: EventGroupComponent;
  config?: EventGroupingConfig;
  matched_rule?: string;
  values?: Array<string>;
}

interface ComponentVariant extends BaseVariant, HasComponentGrouping {
  type: EventGroupVariantType.COMPONENT;
}

interface CustomFingerprintVariant extends BaseVariant, HasComponentGrouping {
  type: EventGroupVariantType.CUSTOM_FINGERPRINT;
}

interface SaltedComponentVariant extends BaseVariant, HasComponentGrouping {
  type: EventGroupVariantType.SALTED_COMPONENT;
}

interface PerformanceProblemVariant extends BaseVariant {
  evidence: VariantEvidence;
  type: EventGroupVariantType.PERFORMANCE_PROBLEM;
}

export type EventGroupVariant =
  | FallbackVariant
  | ChecksumVariant
  | ComponentVariant
  | SaltedComponentVariant
  | CustomFingerprintVariant
  | PerformanceProblemVariant;

export type EventGroupInfo = Record<EventGroupVariantKey, EventGroupVariant>;

/**
 * SDK Update metadata
 */
type EnableIntegrationSuggestion = {
  enables: Array<SDKUpdatesSuggestion>;
  integrationName: string;
  type: 'enableIntegration';
  integrationUrl?: string | null;
};

export type UpdateSdkSuggestion = {
  enables: Array<SDKUpdatesSuggestion>;
  newSdkVersion: string;
  sdkName: string;
  type: 'updateSdk';
  sdkUrl?: string | null;
};

type ChangeSdkSuggestion = {
  enables: Array<SDKUpdatesSuggestion>;
  newSdkName: string;
  type: 'changeSdk';
  sdkUrl?: string | null;
};

export type SDKUpdatesSuggestion =
  | EnableIntegrationSuggestion
  | UpdateSdkSuggestion
  | ChangeSdkSuggestion;

/**
 * Frames, Threads and Event interfaces.
 */
export interface Thread {
  crashed: boolean;
  current: boolean;
  id: number;
  rawStacktrace: RawStacktrace;
  stacktrace: StacktraceType | null;
  name?: string | null;
  state?: string | null;
}

export type Frame = {
  absPath: string | null;
  colNo: number | null;
  context: Array<[number, string]>;
  errors: Array<any> | null;
  filename: string | null;
  function: string | null;
  inApp: boolean;
  instructionAddr: string | null;
  lineNo: number | null;
  module: string | null;
  package: string | null;
  platform: PlatformType | null;
  rawFunction: string | null;
  symbol: string | null;
  symbolAddr: string | null;
  trust: any | null;
  vars: Record<string, any> | null;
  addrMode?: string;
  isPrefix?: boolean;
  isSentinel?: boolean;
  map?: string | null;
  mapUrl?: string | null;
  minGroupingLevel?: number;
  origAbsPath?: string | null;
  symbolicatorStatus?: SymbolicatorStatus;
};

export enum FrameBadge {
  SENTINEL = 'sentinel',
  PREFIX = 'prefix',
  GROUPING = 'grouping',
}

export type ExceptionValue = {
  mechanism: StackTraceMechanism | null;
  module: string | null;
  rawStacktrace: RawStacktrace;
  stacktrace: StacktraceType | null;
  threadId: number | null;
  type: string;
  value: string;
  frames?: Frame[] | null;
};

export type ExceptionType = {
  excOmitted: any | null;
  hasSystemFrames: boolean;
  values?: Array<ExceptionValue>;
};

export type TreeLabelPart =
  | string
  | {
      classbase?: string;
      datapath?: (string | number)[];
      filebase?: string;
      function?: string;
      is_prefix?: boolean;
      // is_sentinel is no longer being used,
      // but we will still assess whether we will use this property in the near future.
      is_sentinel?: boolean;
      package?: string;
      type?: string;
    };

// This type is incomplete
export type EventMetadata = {
  current_level?: number;
  current_tree_label?: TreeLabelPart[];
  directive?: string;
  display_title_with_tree_label?: boolean;
  filename?: string;
  finest_tree_label?: TreeLabelPart[];
  function?: string;
  message?: string;
  origin?: string;
  stripped_crash?: boolean;
  title?: string;
  type?: string;
  uri?: string;
  value?: string;
};

export enum EventOrGroupType {
  ERROR = 'error',
  CSP = 'csp',
  HPKP = 'hpkp',
  EXPECTCT = 'expectct',
  EXPECTSTAPLE = 'expectstaple',
  DEFAULT = 'default',
  TRANSACTION = 'transaction',
}

/**
 * Event interface types.
 */
export enum EntryType {
  EXCEPTION = 'exception',
  MESSAGE = 'message',
  REQUEST = 'request',
  STACKTRACE = 'stacktrace',
  TEMPLATE = 'template',
  CSP = 'csp',
  EXPECTCT = 'expectct',
  EXPECTSTAPLE = 'expectstaple',
  HPKP = 'hpkp',
  BREADCRUMBS = 'breadcrumbs',
  THREADS = 'threads',
  DEBUGMETA = 'debugmeta',
  SPANS = 'spans',
  RESOURCES = 'resources',
}

type EntryDebugMeta = {
  data: {
    images: Array<Image | null>;
  };
  type: EntryType.DEBUGMETA;
};

type EntryBreadcrumbs = {
  data: {
    values: Array<RawCrumb>;
  };
  type: EntryType.BREADCRUMBS;
};

export type EntryThreads = {
  data: {
    values?: Array<Thread>;
  };
  type: EntryType.THREADS;
};

export type EntryException = {
  data: ExceptionType;
  type: EntryType.EXCEPTION;
};

type EntryStacktrace = {
  data: StacktraceType;
  type: EntryType.STACKTRACE;
};

export type EntrySpans = {
  data: RawSpanType[];
  type: EntryType.SPANS;
};

type EntryMessage = {
  data: {
    formatted: string;
    params?: Record<string, any> | any[];
  };
  type: EntryType.MESSAGE;
};

export type EntryRequest = {
  data: {
    method: string;
    url: string;
    cookies?: [key: string, value: string][];
    data?: string | null | Record<string, any> | [key: string, value: any][];
    env?: Record<string, string>;
    fragment?: string | null;
    headers?: [key: string, value: string][];
    inferredContentType?:
      | null
      | 'application/json'
      | 'application/x-www-form-urlencoded'
      | 'multipart/form-data';
    query?: [key: string, value: string][] | string;
  };
  type: EntryType.REQUEST;
};

type EntryTemplate = {
  data: Frame;
  type: EntryType.TEMPLATE;
};

type EntryCsp = {
  data: Record<string, any>;
  type: EntryType.CSP;
};

type EntryGeneric = {
  data: Record<string, any>;
  type: EntryType.EXPECTCT | EntryType.EXPECTSTAPLE | EntryType.HPKP;
};

type EntryResources = {
  data: any; // Data is unused here
  type: EntryType.RESOURCES;
};

export type Entry =
  | EntryDebugMeta
  | EntryBreadcrumbs
  | EntryThreads
  | EntryException
  | EntryStacktrace
  | EntrySpans
  | EntryMessage
  | EntryRequest
  | EntryTemplate
  | EntryCsp
  | EntryGeneric
  | EntryResources;

// Contexts: https://develop.sentry.dev/sdk/event-payloads/contexts/

export interface BaseContext {
  type: string;
}

export enum DeviceContextKey {
  ARCH = 'arch',
  BATTERY_LEVEL = 'battery_level',
  BATTERY_STATUS = 'battery_status',
  BOOT_TIME = 'boot_time',
  BRAND = 'brand',
  CHARGING = 'charging',
  CPU_DESCRIPTION = 'cpu_description',
  DEVICE_TYPE = 'device_type',
  DEVICE_UNIQUE_IDENTIFIER = 'device_unique_identifier',
  EXTERNAL_FREE_STORAGE = 'external_free_storage',
  EXTERNAL_STORAGE_SIZE = 'external_storage_size',
  EXTERNAL_TOTAL_STORAGE = 'external_total_storage',
  FAMILY = 'family',
  FREE_MEMORY = 'free_memory',
  FREE_STORAGE = 'free_storage',
  LOW_MEMORY = 'low_memory',
  MANUFACTURER = 'manufacturer',
  MEMORY_SIZE = 'memory_size',
  MODEL = 'model',
  MODEL_ID = 'model_id',
  NAME = 'name',
  ONLINE = 'online',
  ORIENTATION = 'orientation',
  PROCESSOR_COUNT = 'processor_count',
  PROCESSOR_FREQUENCY = 'processor_frequency',
  SCREEN_DENSITY = 'screen_density',
  SCREEN_DPI = 'screen_dpi',
  SCREEN_HEIGHT_PIXELS = 'screen_height_pixels',
  SCREEN_RESOLUTION = 'screen_resolution',
  SCREEN_WIDTH_PIXELS = 'screen_width_pixels',
  SIMULATOR = 'simulator',
  STORAGE_SIZE = 'storage_size',
  SUPPORTS_ACCELEROMETER = 'supports_accelerometer',
  SUPPORTS_AUDIO = 'supports_audio',
  SUPPORTS_GYROSCOPE = 'supports_gyroscope',
  SUPPORTS_LOCATION_SERVICE = 'supports_location_service',
  SUPPORTS_VIBRATION = 'supports_vibration',
  USABLE_MEMORY = 'usable_memory',
}

// https://develop.sentry.dev/sdk/event-payloads/contexts/#device-context
export interface DeviceContext
  extends Partial<Record<DeviceContextKey, unknown>>,
    BaseContext {
  type: 'device';
  [DeviceContextKey.NAME]: string;
  [DeviceContextKey.ARCH]?: string;
  [DeviceContextKey.BATTERY_LEVEL]?: number;
  [DeviceContextKey.BATTERY_STATUS]?: string;
  [DeviceContextKey.BOOT_TIME]?: string;
  [DeviceContextKey.BRAND]?: string;
  [DeviceContextKey.CHARGING]?: boolean;
  [DeviceContextKey.CPU_DESCRIPTION]?: string;
  [DeviceContextKey.DEVICE_TYPE]?: string;
  [DeviceContextKey.DEVICE_UNIQUE_IDENTIFIER]?: string;
  [DeviceContextKey.EXTERNAL_FREE_STORAGE]?: number;
  [DeviceContextKey.EXTERNAL_STORAGE_SIZE]?: number;
  [DeviceContextKey.EXTERNAL_TOTAL_STORAGE]?: number;
  [DeviceContextKey.FAMILY]?: string;
  [DeviceContextKey.FREE_MEMORY]?: number;
  [DeviceContextKey.FREE_STORAGE]?: number;
  [DeviceContextKey.LOW_MEMORY]?: boolean;
  [DeviceContextKey.MANUFACTURER]?: string;
  [DeviceContextKey.MEMORY_SIZE]?: number;
  [DeviceContextKey.MODEL]?: string;
  [DeviceContextKey.MODEL_ID]?: string;
  [DeviceContextKey.ONLINE]?: boolean;
  [DeviceContextKey.ORIENTATION]?: 'portrait' | 'landscape';
  [DeviceContextKey.PROCESSOR_COUNT]?: number;
  [DeviceContextKey.PROCESSOR_FREQUENCY]?: number;
  [DeviceContextKey.SCREEN_DENSITY]?: number;
  [DeviceContextKey.SCREEN_DPI]?: number;
  [DeviceContextKey.SCREEN_HEIGHT_PIXELS]?: number;
  [DeviceContextKey.SCREEN_RESOLUTION]?: string;
  [DeviceContextKey.SCREEN_WIDTH_PIXELS]?: number;
  [DeviceContextKey.SIMULATOR]?: boolean;
  [DeviceContextKey.STORAGE_SIZE]?: number;
  [DeviceContextKey.SUPPORTS_ACCELEROMETER]?: boolean;
  [DeviceContextKey.SUPPORTS_AUDIO]?: boolean;
  [DeviceContextKey.SUPPORTS_GYROSCOPE]?: boolean;
  [DeviceContextKey.SUPPORTS_LOCATION_SERVICE]?: boolean;
  [DeviceContextKey.SUPPORTS_VIBRATION]?: boolean;
  [DeviceContextKey.USABLE_MEMORY]?: number;
  // This field is deprecated in favour of locale field in culture context
  language?: string;
  // This field is deprecated in favour of timezone field in culture context
  timezone?: string;
}

enum RuntimeContextKey {
  BUILD = 'build',
  NAME = 'name',
  RAW_DESCRIPTION = 'raw_description',
  VERSION = 'version',
}

// https://develop.sentry.dev/sdk/event-payloads/contexts/#runtime-context
interface RuntimeContext
  extends Partial<Record<RuntimeContextKey, unknown>>,
    BaseContext {
  type: 'runtime';
  [RuntimeContextKey.BUILD]?: string;
  [RuntimeContextKey.NAME]?: string;
  [RuntimeContextKey.RAW_DESCRIPTION]?: string;
  [RuntimeContextKey.VERSION]?: number;
}

type OSContext = {
  build: string;
  kernel_version: string;
  name: string;
  type: string;
  version: string;
};

export enum OtelContextKey {
  ATTRIBUTES = 'attributes',
  RESOURCE = 'resource',
}

// OpenTelemetry Context
// https://develop.sentry.dev/sdk/performance/opentelemetry/#opentelemetry-context
interface OtelContext extends Partial<Record<OtelContextKey, unknown>>, BaseContext {
  type: 'otel';
  [OtelContextKey.ATTRIBUTES]?: Record<string, unknown>;
  [OtelContextKey.RESOURCE]?: Record<string, unknown>;
}

export enum UnityContextKey {
  COPY_TEXTURE_SUPPORT = 'copy_texture_support',
  EDITOR_VERSION = 'editor_version',
  INSTALL_MODE = 'install_mode',
  RENDERING_THREADING_MODE = 'rendering_threading_mode',
  TARGET_FRAME_RATE = 'target_frame_rate',
}

// Unity Context
// TODO(Priscila): Add this context to the docs
export interface UnityContext {
  [UnityContextKey.COPY_TEXTURE_SUPPORT]: string;
  [UnityContextKey.EDITOR_VERSION]: string;
  [UnityContextKey.INSTALL_MODE]: string;
  [UnityContextKey.RENDERING_THREADING_MODE]: string;
  [UnityContextKey.TARGET_FRAME_RATE]: string;
  type: 'unity';
}

export enum MemoryInfoContextKey {
  ALLOCATED_BYTES = 'allocated_bytes',
  FRAGMENTED_BYTES = 'fragmented_bytes',
  HEAP_SIZE_BYTES = 'heap_size_bytes',
  HIGH_MEMORY_LOAD_THRESHOLD_BYTES = 'high_memory_load_threshold_bytes',
  TOTAL_AVAILABLE_MEMORY_BYTES = 'total_available_memory_bytes',
  MEMORY_LOAD_BYTES = 'memory_load_bytes',
  TOTAL_COMMITTED_BYTES = 'total_committed_bytes',
  PROMOTED_BYTES = 'promoted_bytes',
  PINNED_OBJECTS_COUNT = 'pinned_objects_count',
  PAUSE_TIME_PERCENTAGE = 'pause_time_percentage',
  INDEX = 'index',
  FINALIZATION_PENDING_COUNT = 'finalization_pending_count',
  COMPACTED = 'compacted',
  CONCURRENT = 'concurrent',
  PAUSE_DURATIONS = 'pause_durations',
}

// MemoryInfo Context
// TODO(Priscila): Add this context to the docs
export interface MemoryInfoContext {
  type: 'Memory Info' | 'memory_info';
  [MemoryInfoContextKey.FINALIZATION_PENDING_COUNT]: number;
  [MemoryInfoContextKey.COMPACTED]: boolean;
  [MemoryInfoContextKey.CONCURRENT]: boolean;
  [MemoryInfoContextKey.PAUSE_DURATIONS]: number[];
  [MemoryInfoContextKey.TOTAL_AVAILABLE_MEMORY_BYTES]?: number;
  [MemoryInfoContextKey.MEMORY_LOAD_BYTES]?: number;
  [MemoryInfoContextKey.TOTAL_COMMITTED_BYTES]?: number;
  [MemoryInfoContextKey.PROMOTED_BYTES]?: number;
  [MemoryInfoContextKey.PINNED_OBJECTS_COUNT]?: number;
  [MemoryInfoContextKey.PAUSE_TIME_PERCENTAGE]?: number;
  [MemoryInfoContextKey.INDEX]?: number;
  [MemoryInfoContextKey.ALLOCATED_BYTES]?: number;
  [MemoryInfoContextKey.FRAGMENTED_BYTES]?: number;
  [MemoryInfoContextKey.HEAP_SIZE_BYTES]?: number;
  [MemoryInfoContextKey.HIGH_MEMORY_LOAD_THRESHOLD_BYTES]?: number;
}

export enum ThreadPoolInfoContextKey {
  MIN_WORKER_THREADS = 'min_worker_threads',
  MIN_COMPLETION_PORT_THREADS = 'min_completion_port_threads',
  MAX_WORKER_THREADS = 'max_worker_threads',
  MAX_COMPLETION_PORT_THREADS = 'max_completion_port_threads',
  AVAILABLE_WORKER_THREADS = 'available_worker_threads',
  AVAILABLE_COMPLETION_PORT_THREADS = 'available_completion_port_threads',
}

// ThreadPoolInfo Context
// TODO(Priscila): Add this context to the docs
export interface ThreadPoolInfoContext {
  type: 'ThreadPool Info' | 'threadpool_info';
  [ThreadPoolInfoContextKey.MIN_WORKER_THREADS]: number;
  [ThreadPoolInfoContextKey.MIN_COMPLETION_PORT_THREADS]: number;
  [ThreadPoolInfoContextKey.MAX_WORKER_THREADS]: number;
  [ThreadPoolInfoContextKey.MAX_COMPLETION_PORT_THREADS]: number;
  [ThreadPoolInfoContextKey.AVAILABLE_WORKER_THREADS]: number;
  [ThreadPoolInfoContextKey.AVAILABLE_COMPLETION_PORT_THREADS]: number;
}

export enum ProfileContextKey {
  PROFILE_ID = 'profile_id',
}

export interface ProfileContext {
  [ProfileContextKey.PROFILE_ID]?: string;
}

export interface BrowserContext {
  name: string;
  version: string;
}

type EventContexts = {
  'Memory Info'?: MemoryInfoContext;
  'ThreadPool Info'?: ThreadPoolInfoContext;
  browser?: BrowserContext;
  client_os?: OSContext;
  device?: DeviceContext;
  feedback?: Record<string, any>;
  memory_info?: MemoryInfoContext;
  os?: OSContext;
  otel?: OtelContext;
  // TODO (udameli): add better types here
  // once perf issue data shape is more clear
  performance_issue?: any;
  runtime?: RuntimeContext;
  threadpool_info?: ThreadPoolInfoContext;
  trace?: TraceContextType;
  unity?: UnityContext;
};

export type Measurement = {value: number; unit?: string};

export type EventTag = {key: string; value: string};

export type EventUser = {
  data?: string | null;
  email?: string;
  id?: string;
  ip_address?: string;
  name?: string | null;
  username?: string | null;
};

export type PerformanceDetectorData = {
  causeSpanIds: string[];
  offenderSpanIds: string[];
  parentSpanIds: string[];
  issueType?: IssueType;
};

type EventEvidenceDisplay = {
  /**
   * Used for alerting, probably not useful for the UI
   */
  important: boolean;
  name: string;
  value: string;
};

type EventOccurrence = {
  detectionTime: string;
  eventId: string;
  /**
   * Arbitrary data that vertical teams can pass to assist with rendering the page.
   * This is intended mostly for use with customizing the UI, not in the generic UI.
   */
  evidenceData: Record<string, any>;
  /**
   * Data displayed in the evidence table. Used in all issue types besides errors.
   */
  evidenceDisplay: EventEvidenceDisplay[];
  fingerprint: string[];
  id: string;
  issueTitle: string;
  resourceId: string;
  subtitle: string;
  type: number;
};

interface EventBase {
  contexts: EventContexts;
  crashFile: IssueAttachment | null;
  culprit: string;
  dateReceived: string;
  dist: string | null;
  entries: Entry[];
  errors: any[];
  eventID: string;
  fingerprints: string[];
  id: string;
  location: string | null;
  message: string;
  metadata: EventMetadata;
  occurrence: EventOccurrence | null;
  projectID: string;
  size: number;
  tags: EventTag[];
  title: string;
  type:
    | EventOrGroupType.CSP
    | EventOrGroupType.DEFAULT
    | EventOrGroupType.EXPECTCT
    | EventOrGroupType.EXPECTSTAPLE
    | EventOrGroupType.HPKP;
  user: EventUser | null;
  _meta?: Record<string, any>;
  context?: Record<string, any>;
  dateCreated?: string;
  device?: Record<string, any>;
  endTimestamp?: number;
  groupID?: string;
  groupingConfig?: {
    enhancements: string;
    id: string;
  };
  issueCategory?: IssueCategory;
  latestEventID?: string | null;
  measurements?: Record<string, Measurement>;
  nextEventID?: string | null;
  oldestEventID?: string | null;
  packages?: Record<string, string>;
  platform?: PlatformType;
  previousEventID?: string | null;
  projectSlug?: string;
  release?: Release | null;
  sdk?: {
    name: string;
    version: string;
  } | null;
  sdkUpdates?: Array<SDKUpdatesSuggestion>;
  userReport?: any;
}

interface TraceEventContexts extends EventContexts {
  browser?: BrowserContext;
  profile?: ProfileContext;
}

export interface EventTransaction
  extends Omit<EventBase, 'entries' | 'type' | 'contexts'> {
  contexts: TraceEventContexts;
  endTimestamp: number;
  entries: (EntrySpans | EntryRequest)[];
  startTimestamp: number;
  type: EventOrGroupType.TRANSACTION;
  perfProblem?: PerformanceDetectorData;
}

export interface EventError extends Omit<EventBase, 'entries' | 'type'> {
  entries: (
    | EntryException
    | EntryStacktrace
    | EntryRequest
    | EntryThreads
    | EntryDebugMeta
  )[];
  type: EventOrGroupType.ERROR;
}

export type Event = EventError | EventTransaction | EventBase;

// Response from EventIdLookupEndpoint
// /organizations/${orgSlug}/eventids/${eventId}/
export type EventIdResponse = {
  event: Event;
  eventId: string;
  groupId: string;
  organizationSlug: string;
  projectSlug: string;
};
