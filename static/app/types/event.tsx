import type {DebugImage} from 'sentry/components/events/interfaces/debugMeta/types';
import type {TraceContextType} from 'sentry/components/events/interfaces/spans/types';
import type {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import type {PlatformKey} from 'sentry/data/platformCategories';

import type {RawCrumb} from './breadcrumbs';
import type {IssueAttachment} from './group';
import type {Release} from './release';
import type {RawStacktrace, StackTraceMechanism, StacktraceType} from './stacktrace';

// TODO(epurkhiser): objc and cocoa should almost definitely be moved into PlatformKey
export type PlatformType = PlatformKey | 'objc' | 'cocoa';

export type Level = 'error' | 'fatal' | 'info' | 'warning' | 'sample';

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

type EventGroupVariantKey = 'custom-fingerprint' | 'app' | 'default' | 'system';

export enum EventGroupVariantType {
  CUSTOM_FINGERPRINT = 'custom-fingerprint',
  COMPONENT = 'component',
  SALTED_COMPONENT = 'salted-component',
}

export type EventGroupVariant = {
  description: string | null;
  hash: string | null;
  hashMismatch: boolean;
  key: EventGroupVariantKey;
  type: EventGroupVariantType;
  client_values?: Array<string>;
  component?: EventGroupComponent;
  config?: EventGroupingConfig;
  matched_rule?: string;
  values?: Array<string>;
};

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
}

type EntryDebugMeta = {
  data: {
    images: Array<DebugImage>;
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
  type: EntryType.SPANS; // data is not used
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
    fragment?: string;
    headers?: [key: string, value: string][];
    inferredContentType?:
      | null
      | 'application/json'
      | 'application/x-www-form-urlencoded'
      | 'multipart/form-data';
    query?: [key: string, value: string][];
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
  | EntryGeneric;

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
  os?: OSContext;
  runtime?: RuntimeContext;
  trace?: TraceContextType;
};

export type Measurement = {value: number};

export type EventTag = {key: string; value: string};

export type EventUser = {
  data?: string | null;
  email?: string;
  id?: string;
  ip_address?: string;
  name?: string | null;
  username?: string | null;
};

type EventBase = {
  contexts: EventContexts;
  crashFile: IssueAttachment | null;
  culprit: string;
  dateReceived: string;
  dist: string | null;
  entries: Entry[];
  errors: any[];
  eventID: string;
  fingerprints: string[];
  groupingConfig: {
    enhancements: string;
    id: string;
  };
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
  context?: Record<string, any>;
  dateCreated?: string;
  device?: Record<string, any>;
  endTimestamp?: number;
  groupID?: string;
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
};

export type EventTransaction = Omit<EventBase, 'entries' | 'type'> & {
  endTimestamp: number;
  entries: (EntrySpans | EntryRequest)[];
  startTimestamp: number;
  type: EventOrGroupType.TRANSACTION;
  contexts?: {
    trace?: TraceContextType;
  };
  title?: string;
};

export type EventError = Omit<EventBase, 'entries' | 'type'> & {
  entries: (
    | EntryException
    | EntryStacktrace
    | EntryRequest
    | EntryThreads
    | EntryDebugMeta
  )[];
  type: EventOrGroupType.ERROR;
};

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
