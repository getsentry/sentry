import type {TraceContextType} from 'sentry/components/events/interfaces/spans/types';
import type {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import type {PlatformKey} from 'sentry/data/platformCategories';

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

type EntrySpans = {
  data: any;
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

// Contexts
type RuntimeContext = {
  type: 'runtime';
  build?: string;
  name?: string;
  raw_description?: string;
  version?: number;
};

type DeviceContext = {
  arch: string;
  family: string;
  model: string;
  type: string;
};

type OSContext = {
  build: string;
  kernel_version: string;
  name: string;
  type: string;
  version: string;
};

type EventContexts = {
  client_os?: OSContext;
  device?: DeviceContext;
  feedback?: Record<string, any>;
  os?: OSContext;
  // TODO (udameli): add better types here
  // once perf issue data shape is more clear
  performance_issue?: any;
  runtime?: RuntimeContext;
  trace?: TraceContextType;
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
  trace?: TraceContextType;
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
