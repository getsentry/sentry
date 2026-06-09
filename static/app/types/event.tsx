import type {CloudResourceContext} from '@sentry/core';

import type {AppContext} from 'sentry/components/events/contexts/knownContext/app';
import type {CultureContext} from 'sentry/components/events/contexts/knownContext/culture';
import type {MissingInstrumentationContext} from 'sentry/components/events/contexts/knownContext/missingInstrumentation';
import type {
  AggregateSpanType,
  RawSpanType,
  TraceContextType,
} from 'sentry/components/events/interfaces/spans/types';
import type {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import {EntryType, EventOrGroupType} from 'sentry/types/eventBase';
import type {
  BrowserContext,
  DeviceContext,
  EntryCsp,
  EntryGeneric,
  EntryMessage,
  EntryRequest,
  EntryResources,
  EventMetadata,
  EventOccurrence,
  EventTag,
  EventUser,
  Flags,
  Lock,
  Measurement,
  MemoryInfoContext,
  MetricAlertContextType,
  OSContext,
  OtelContext,
  PerformanceDetectorData,
  ProfileContext,
  ReplayContext,
  ResponseContext,
  RuntimeContext,
  ThreadPoolInfoContext,
  UnityContext,
} from 'sentry/types/eventBase';

import type {RawCrumb} from './breadcrumbs';
import type {Image} from './debugImage';
import type {UserReport} from './group';
import type {IssueAttachment, IssueCategory} from './groupBase';
import type {PlatformKey} from './platform';
import type {Release} from './release';
import type {StackTraceMechanism, StacktraceType} from './stacktrace';

/**
 * SDK Update metadata
 */
type EnableIntegrationSuggestion = {
  enables: SDKUpdatesSuggestion[];
  integrationName: string;
  type: 'enableIntegration';
  integrationUrl?: string | null;
};

type UpdateSdkSuggestion = {
  enables: SDKUpdatesSuggestion[];
  newSdkVersion: string;
  sdkName: string;
  type: 'updateSdk';
  sdkUrl?: string | null;
};

type ChangeSdkSuggestion = {
  enables: SDKUpdatesSuggestion[];
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
  rawStacktrace: StacktraceType | null;
  stacktrace: StacktraceType | null;
  heldLocks?: Record<string, Lock> | null;
  name?: string | null;
  state?: string | null;
}

export type Frame = {
  absPath: string | null;
  colNo: number | null;
  context: Array<[number, string | null]>;
  filename: string | null;
  function: string | null;
  inApp: boolean;
  instructionAddr: string | null;
  lineNo: number | null;
  module: string | null;
  package: string | null;
  platform: PlatformKey | null;
  rawFunction: string | null;
  symbol: string | null;
  symbolAddr: string | null;
  trust: any | null;
  vars: Record<string, any> | null;
  addrMode?: string;
  lock?: Lock | null;
  // map exists if the frame has a source map
  map?: string | null;
  mapUrl?: string | null;
  minGroupingLevel?: number;
  origAbsPath?: string | null;
  parentIndex?: number | null;
  sampleCount?: number | null;
  sourceLink?: string | null;
  symbolicatorStatus?: SymbolicatorStatus;
};

export type ExceptionValue = {
  mechanism: StackTraceMechanism | null;
  module: string | null;
  rawStacktrace: StacktraceType | null;
  stacktrace: StacktraceType | null;
  threadId: number | null;
  type: string;
  value: string | null;
  frames?: Frame[] | null;
  rawModule?: string | null;
  rawType?: string | null;
  rawValue?: string | null;
};

export type ExceptionType = {
  excOmitted: any | null;
  hasSystemFrames: boolean;
  values?: ExceptionValue[];
};

export type EntryDebugMeta = {
  data: {
    images?: Array<Image | null>;
    sdk_info?: {
      sdk_name: string;
      version_major: number;
      version_minor: number;
      version_patchlevel: number;
    };
  };
  type: EntryType.DEBUGMETA;
};

type EntryBreadcrumbs = {
  data: {
    values: RawCrumb[];
  };
  type: EntryType.BREADCRUMBS;
};

export type EntryThreads = {
  data: {
    values?: Thread[];
  };
  type: EntryType.THREADS;
};

export type EntryException = {
  data: ExceptionType;
  type: EntryType.EXCEPTION;
};

export type EntryStacktrace = {
  data: StacktraceType;
  type: EntryType.STACKTRACE;
};

export type EntrySpans = {
  data: RawSpanType[];
  type: EntryType.SPANS;
};

export type AggregateEntrySpans = {
  data: AggregateSpanType[];
  type: EntryType.SPANS;
};

type EntryTemplate = {
  data: Frame;
  type: EntryType.TEMPLATE;
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

/** Maps each EntryType to its corresponding Entry subtype. */
export type EntryMap = {
  [E in Entry as E['type']]: E;
};

// Contexts: https://develop.sentry.dev/sdk/event-payloads/contexts/

export type EventContexts = {
  'Current Culture'?: CultureContext;
  'Memory Info'?: MemoryInfoContext;
  'ThreadPool Info'?: ThreadPoolInfoContext;
  app?: AppContext;
  browser?: BrowserContext;
  client_os?: OSContext;
  cloud_resource?: CloudResourceContext;
  culture?: CultureContext;
  device?: DeviceContext;
  feedback?: Record<string, any>;
  flags?: Flags;
  memory_info?: MemoryInfoContext;
  metric_alert?: MetricAlertContextType;
  missing_instrumentation?: MissingInstrumentationContext;
  os?: OSContext;
  otel?: OtelContext;
  // TODO (udameli): add better types here
  // once perf issue data shape is more clear
  performance_issue?: any;
  profile?: ProfileContext;
  replay?: ReplayContext;
  response?: ResponseContext;
  runtime?: RuntimeContext;
  threadpool_info?: ThreadPoolInfoContext;
  trace?: TraceContextType;
  unity?: UnityContext;
};

type EventRelease = Pick<
  Release,
  | 'commitCount'
  | 'data'
  | 'dateCreated'
  | 'dateReleased'
  | 'deployCount'
  | 'id'
  | 'lastCommit'
  | 'lastDeploy'
  | 'ref'
  | 'status'
  | 'url'
  | 'userAgent'
  | 'version'
  | 'versionInfo'
>;

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
  platform?: PlatformKey;
  previousEventID?: string | null;
  projectSlug?: string;
  release?: EventRelease | null;
  resolvedWith?: string[];
  sdk?: {
    name: string | null;
    version: string | null;
  } | null;
  sdkUpdates?: SDKUpdatesSuggestion[];
  userReport?: UserReport | null;
}

interface TraceEventContexts extends EventContexts {
  browser?: BrowserContext;
  profile?: ProfileContext;
}

export interface EventTransaction extends Omit<
  EventBase,
  'entries' | 'type' | 'contexts'
> {
  contexts: TraceEventContexts;
  endTimestamp: number;
  // EntryDebugMeta is required for profiles to render in the span
  // waterfall with the correct symbolication statuses
  entries: Array<
    EntrySpans | EntryRequest | EntryDebugMeta | AggregateEntrySpans | EntryBreadcrumbs
  >;
  startTimestamp: number;
  type: EventOrGroupType.TRANSACTION;
  perfProblem?: PerformanceDetectorData;
}

export interface AggregateEventTransaction extends Omit<
  EventTransaction,
  | 'crashFile'
  | 'culprit'
  | 'dist'
  | 'dateReceived'
  | 'errors'
  | 'location'
  | 'metadata'
  | 'message'
  | 'occurrence'
  | 'type'
  | 'size'
  | 'user'
  | 'eventID'
  | 'fingerprints'
  | 'id'
  | 'projectID'
  | 'tags'
  | 'title'
> {
  count: number;
  frequency: number;
  total: number;
  type: EventOrGroupType.AGGREGATE_TRANSACTION;
}

export interface EventError extends Omit<EventBase, 'entries' | 'type'> {
  entries: Array<
    EntryException | EntryStacktrace | EntryRequest | EntryThreads | EntryDebugMeta
  >;
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
