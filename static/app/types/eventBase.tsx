import type {IssueType} from 'sentry/types/groupBase';

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
type VariantEvidence = {
  desc: string;
  fingerprint: string;
  cause_span_hashes?: string[];
  cause_span_ids?: string[];
  offender_span_hashes?: string[];
  offender_span_ids?: string[];
  op?: string;
  parent_span_hashes?: string[];
  parent_span_ids?: string[];
};
export const enum EventGroupVariantType {
  CHECKSUM = 'checksum',
  FALLBACK = 'fallback',
  CUSTOM_FINGERPRINT = 'custom_fingerprint',
  COMPONENT = 'component',
  SALTED_COMPONENT = 'salted_component',
  PERFORMANCE_PROBLEM = 'performance_problem',
}
interface BaseVariant {
  contributes: boolean;
  description: string | null;
  hash: string | null;
  hashMismatch: boolean;
  hint: string | null;
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
  client_values?: string[];
  component?: EventGroupComponent;
  matched_rule?: string;
  values?: string[];
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
export type Lock = {
  type: LockType;
  address?: string | null;
  class_name?: string | null;
  package_name?: string | null;
  thread_id?: number | null;
};
export enum LockType {
  LOCKED = 1,
  WAITING = 2,
  SLEEPING = 4,
  BLOCKED = 8,
}
// This type is incomplete
export type EventMetadata = {
  current_level?: number;
  directive?: string;
  filename?: string;
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
  NEL = 'nel',
  DEFAULT = 'default',
  TRANSACTION = 'transaction',
  AGGREGATE_TRANSACTION = 'aggregateTransaction',
  GENERIC = 'generic',
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
  THREAD_STATE = 'thread-state',
  THREAD_TAGS = 'thread-tags',
  DEBUGMETA = 'debugmeta',
  SPANS = 'spans',
  RESOURCES = 'resources',
}
export type EntryMessage = {
  data: {
    formatted: string;
    params?: Record<string, any> | any[];
  };
  type: EntryType.MESSAGE;
};
interface EntryRequestDataDefault {
  apiTarget: null;
  method: string | null;
  url: string;
  cookies?: Array<[key: string, value: string] | null>;
  data?: string | null | Record<string, any> | Array<[key: string, value: any]>;
  env?: Record<string, string> | null;
  fragment?: string | null;
  headers?: Array<[key: string, value: string] | null>;
  inferredContentType?:
    | null
    | 'application/json'
    | 'application/x-www-form-urlencoded'
    | 'multipart/form-data';
  query?: Array<[key: string, value: string] | null> | string;
}
export interface EntryRequestDataGraphQl extends Omit<
  EntryRequestDataDefault,
  'apiTarget' | 'data'
> {
  apiTarget: 'graphql';
  data: {
    query: string;
    variables: Record<string, string | number | null>;
    operationName?: string;
  };
}
export type EntryRequest = {
  data: EntryRequestDataDefault | EntryRequestDataGraphQl;
  type: EntryType.REQUEST;
};
export type EntryCsp = {
  data: Record<string, any>;
  type: EntryType.CSP;
};
export type EntryGeneric = {
  data: Record<string, any>;
  type: EntryType.EXPECTCT | EntryType.EXPECTSTAPLE | EntryType.HPKP;
};
export type EntryResources = {
  data: any; // Data is unused here
  type: EntryType.RESOURCES;
};
interface BaseContext {
  type: string;
}
export enum DeviceContextKey {
  ARCH = 'arch',
  BATTERY_LEVEL = 'battery_level',
  BATTERY_STATUS = 'battery_status',
  BATTERY_TEMPERATURE = 'battery_temperature',
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
  TIMEZONE = 'timezone',
  LOCALE = 'locale',
  ARCHS = 'archs',
  CHIPSET = 'chipset',
  CONNECTION_TYPE = 'connection_type',
  LOW_POWER_MODE = 'low_power_mode',
  THERMAL_STATE = 'thermal_state',
}
// https://develop.sentry.dev/sdk/event-payloads/contexts/#device-context
export interface DeviceContext
  extends Partial<Record<DeviceContextKey, unknown>>, BaseContext {
  type: 'device';
  [DeviceContextKey.NAME]: string;
  [DeviceContextKey.ARCH]?: string;
  [DeviceContextKey.BATTERY_LEVEL]?: number;
  [DeviceContextKey.BATTERY_STATUS]?: string;
  [DeviceContextKey.BATTERY_TEMPERATURE]?: number;
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
  [DeviceContextKey.LOCALE]?: string;
  [DeviceContextKey.ARCHS]?: string[];
  [DeviceContextKey.CHIPSET]?: string;
  [DeviceContextKey.CONNECTION_TYPE]?: string;
  [DeviceContextKey.LOW_POWER_MODE]?: boolean;
  // This field is deprecated in favour of timezone field in culture context
  [DeviceContextKey.TIMEZONE]?: string;
  [DeviceContextKey.THERMAL_STATE]?: string;
  // This field is deprecated in favour of locale field in culture context
  language?: string;
}
enum RuntimeContextKey {
  BUILD = 'build',
  NAME = 'name',
  RAW_DESCRIPTION = 'raw_description',
  VERSION = 'version',
}
// https://develop.sentry.dev/sdk/event-payloads/contexts/#runtime-context
export interface RuntimeContext
  extends Partial<Record<RuntimeContextKey, unknown>>, BaseContext {
  type: 'runtime';
  [RuntimeContextKey.BUILD]?: string;
  [RuntimeContextKey.NAME]?: string;
  [RuntimeContextKey.RAW_DESCRIPTION]?: string;
  [RuntimeContextKey.VERSION]?: number;
}
export type OSContext = {
  build: string;
  kernel_version: string;
  name: string;
  type: string;
  version: string;
};
enum OtelContextKey {
  ATTRIBUTES = 'attributes',
  RESOURCE = 'resource',
}
// OpenTelemetry Context
// https://develop.sentry.dev/sdk/performance/opentelemetry/#opentelemetry-context
export interface OtelContext
  extends Partial<Record<OtelContextKey, unknown>>, BaseContext {
  type: 'otel';
  [OtelContextKey.ATTRIBUTES]?: Record<string, unknown>;
  [OtelContextKey.RESOURCE]?: Record<string, unknown>;
}
export enum UnityContextKey {
  ACTIVE_SCENE_NAME = 'active_scene_name',
  COPY_TEXTURE_SUPPORT = 'copy_texture_support',
  EDITOR_VERSION = 'editor_version',
  INSTALL_MODE = 'install_mode',
  IS_MAIN_THREAD = 'is_main_thread',
  RENDERING_THREADING_MODE = 'rendering_threading_mode',
  TARGET_FRAME_RATE = 'target_frame_rate',
}
export interface UnityContext {
  [UnityContextKey.ACTIVE_SCENE_NAME]: string;
  [UnityContextKey.COPY_TEXTURE_SUPPORT]: string;
  [UnityContextKey.EDITOR_VERSION]: string;
  [UnityContextKey.INSTALL_MODE]: string;
  [UnityContextKey.IS_MAIN_THREAD]: boolean;
  [UnityContextKey.RENDERING_THREADING_MODE]: string;
  [UnityContextKey.TARGET_FRAME_RATE]: string;
  type: 'unity';
}
export enum MemoryInfoContextKey {
  ALLOCATED_BYTES = 'allocated_bytes',
  TOTAL_ALLOCATED_BYTES = 'total_allocated_bytes',
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
  [MemoryInfoContextKey.TOTAL_ALLOCATED_BYTES]?: number;
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
export interface ThreadPoolInfoContext {
  type: 'ThreadPool Info' | 'threadpool_info';
  [ThreadPoolInfoContextKey.MIN_WORKER_THREADS]: number;
  [ThreadPoolInfoContextKey.MIN_COMPLETION_PORT_THREADS]: number;
  [ThreadPoolInfoContextKey.MAX_WORKER_THREADS]: number;
  [ThreadPoolInfoContextKey.MAX_COMPLETION_PORT_THREADS]: number;
  [ThreadPoolInfoContextKey.AVAILABLE_WORKER_THREADS]: number;
  [ThreadPoolInfoContextKey.AVAILABLE_COMPLETION_PORT_THREADS]: number;
}
export type MetricAlertContextType = {
  alert_rule_id?: string;
};
export enum ProfileContextKey {
  PROFILE_ID = 'profile_id',
  PROFILER_ID = 'profiler_id',
}
export interface ProfileContext {
  [ProfileContextKey.PROFILE_ID]?: string;
  [ProfileContextKey.PROFILER_ID]?: string;
}
export enum ReplayContextKey {
  REPLAY_ID = 'replay_id',
}
export interface ReplayContext {
  [ReplayContextKey.REPLAY_ID]: string;
  type: string;
}
export interface BrowserContext {
  name: string;
  version: string;
}
export interface ResponseContext {
  data: unknown;
  type: 'response';
}
// event.contexts.flags can be overriden by the user so the type is not strict
export type FeatureFlag = {flag?: string; result?: boolean};
export type Flags = {values?: Array<FeatureFlag | null>};
export type Measurement = {value: number; type?: string; unit?: string};
export type EventTag = {key: string; value: string};
export type EventTagWithMeta = EventTag & {meta?: Record<string, any>};
export type EventUser = {
  data?: string | null;
  email?: string;
  geo?: {
    city?: string;
    country_code?: string;
    region?: string;
    subdivision?: string;
  };
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
export type EventEvidenceDisplay = {
  important: boolean;
  name: string;
  value: string;
};
export type EventOccurrence = {
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
