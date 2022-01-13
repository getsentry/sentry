import {DebugImage} from 'sentry/components/events/interfaces/debugMeta/types';
import {TraceContextType} from 'sentry/components/events/interfaces/spans/types';
import {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import {PlatformKey} from 'sentry/data/platformCategories';

import {RawCrumb} from './breadcrumbs';
import {IssueAttachment} from './group';
import {Release} from './release';
import {RawStacktrace, StackTraceMechanism, StacktraceType} from './stacktrace';

// TODO(epurkhiser): objc and cocoa should almost definitely be moved into PlatformKey
export type PlatformType = PlatformKey | 'objc' | 'cocoa';

export type Level = 'error' | 'fatal' | 'info' | 'warning' | 'sample';

/**
 * Grouping Configuration.
 */
export interface EventGroupComponent {
  contributes: boolean;
  hint: string | null;
  id: string;
  name: string | null;
  values: EventGroupComponent[] | string[];
}
export interface EventGroupingConfig {
  base: string | null;
  changelog: string;
  delegates: string[];
  hidden: boolean;
  id: string;
  latest: boolean;
  risk: number;
  strategies: string[];
}

type EventGroupVariantKey = 'custom-fingerprint' | 'app' | 'default' | 'system';

export enum EventGroupVariantType {
  CUSTOM_FINGERPRINT = 'custom-fingerprint',
  COMPONENT = 'component',
  SALTED_COMPONENT = 'salted-component',
}

export interface EventGroupVariant {
  description: string | null;
  hash: string | null;
  hashMismatch: boolean;
  key: EventGroupVariantKey;
  type: EventGroupVariantType;
  values?: Array<string>;
  client_values?: Array<string>;
  matched_rule?: string;
  component?: EventGroupComponent;
  config?: EventGroupingConfig;
}

export type EventGroupInfo = Record<EventGroupVariantKey, EventGroupVariant>;

interface EnableIntegrationSuggestion {
  type: 'enableIntegration';
  integrationName: string;
  enables: Array<SDKUpdatesSuggestion>;
  integrationUrl?: string | null;
}

export interface UpdateSdkSuggestion {
  type: 'updateSdk';
  sdkName: string;
  newSdkVersion: string;
  enables: Array<SDKUpdatesSuggestion>;
  sdkUrl?: string | null;
}

interface ChangeSdkSuggestion {
  type: 'changeSdk';
  newSdkName: string;
  enables: Array<SDKUpdatesSuggestion>;
  sdkUrl?: string | null;
}

export type SDKUpdatesSuggestion =
  | EnableIntegrationSuggestion
  | UpdateSdkSuggestion
  | ChangeSdkSuggestion;

/**
 * Frames, Threads and Event interfaces.
 */
export interface Thread {
  id: number;
  crashed: boolean;
  current: boolean;
  rawStacktrace: RawStacktrace;
  stacktrace: StacktraceType | null;
  name?: string | null;
}

export interface Frame {
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
  symbolicatorStatus?: SymbolicatorStatus;
  addrMode?: string;
  origAbsPath?: string | null;
  mapUrl?: string | null;
  map?: string | null;
  isSentinel?: boolean;
  isPrefix?: boolean;
  minGroupingLevel?: number;
}

export enum FrameBadge {
  SENTINEL = 'sentinel',
  PREFIX = 'prefix',
  GROUPING = 'grouping',
}

export interface ExceptionValue {
  type: string;
  value: string;
  threadId: number | null;
  stacktrace: StacktraceType | null;
  rawStacktrace: RawStacktrace;
  mechanism: StackTraceMechanism | null;
  module: string | null;
  frames?: Frame[] | null;
}

export interface ExceptionType {
  excOmitted: any | null;
  hasSystemFrames: boolean;
  values?: Array<ExceptionValue>;
}

export type TreeLabelPart =
  | string
  | {
      function?: string;
      package?: string;
      type?: string;
      classbase?: string;
      filebase?: string;
      datapath?: (string | number)[];
      // is_sentinel is no longer being used,
      // but we will still assess whether we will use this property in the near future.
      is_sentinel?: boolean;
      is_prefix?: boolean;
    };

// This type is incomplete
export interface EventMetadata {
  value?: string;
  message?: string;
  directive?: string;
  type?: string;
  title?: string;
  uri?: string;
  filename?: string;
  origin?: string;
  function?: string;
  stripped_crash?: boolean;
  current_tree_label?: TreeLabelPart[];
  finest_tree_label?: TreeLabelPart[];
  current_level?: number;
  display_title_with_tree_label?: boolean;
}

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

interface EntryDebugMeta {
  type: EntryType.DEBUGMETA;
  data: {
    images: Array<DebugImage>;
  };
}

interface EntryBreadcrumbs {
  type: EntryType.BREADCRUMBS;
  data: {
    values: Array<RawCrumb>;
  };
}

export interface EntryThreads {
  type: EntryType.THREADS;
  data: {
    values?: Array<Thread>;
  };
}

export interface EntryException {
  type: EntryType.EXCEPTION;
  data: ExceptionType;
}

interface EntryStacktrace {
  type: EntryType.STACKTRACE;
  data: StacktraceType;
}

interface EntrySpans {
  type: EntryType.SPANS;
  data: any; // data is not used;
}

interface EntryMessage {
  type: EntryType.MESSAGE;
  data: {
    formatted: string;
    params?: Record<string, any> | any[];
  };
}

export interface EntryRequest {
  type: EntryType.REQUEST;
  data: {
    url: string;
    method: string;
    data?: string | null | Record<string, any> | [key: string, value: any][];
    query?: [key: string, value: string][];
    fragment?: string;
    cookies?: [key: string, value: string][];
    headers?: [key: string, value: string][];
    env?: Record<string, string>;
    inferredContentType?:
      | null
      | 'application/json'
      | 'application/x-www-form-urlencoded'
      | 'multipart/form-data';
  };
}

interface EntryTemplate {
  type: EntryType.TEMPLATE;
  data: Frame;
}

interface EntryCsp {
  type: EntryType.CSP;
  data: Record<string, any>;
}

interface EntryGeneric {
  type: EntryType.EXPECTCT | EntryType.EXPECTSTAPLE | EntryType.HPKP;
  data: Record<string, any>;
}

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

interface RuntimeContext {
  type: 'runtime';
  version: number;
  build?: string;
  name?: string;
}

interface DeviceContext {
  arch: string;
  family: string;
  model: string;
  type: string;
}

interface OSContext {
  kernel_version: string;
  version: string;
  type: string;
  build: string;
  name: string;
}

interface EventContexts {
  runtime?: RuntimeContext;
  trace?: TraceContextType;
  device?: DeviceContext;
  os?: OSContext;
  client_os?: OSContext;
}

export interface Measurement {
  value: number;
}

export interface EventTag {
  key: string;
  value: string;
}

export interface EventUser {
  username?: string | null;
  name?: string | null;
  ip_address?: string;
  email?: string;
  id?: string;
  data?: string | null;
}

interface EventBase {
  id: string;
  type:
    | EventOrGroupType.CSP
    | EventOrGroupType.DEFAULT
    | EventOrGroupType.EXPECTCT
    | EventOrGroupType.EXPECTSTAPLE
    | EventOrGroupType.HPKP;
  eventID: string;
  title: string;
  culprit: string;
  dist: string | null;
  metadata: EventMetadata;
  contexts: EventContexts;
  user: EventUser | null;
  message: string;
  entries: Entry[];
  errors: any[];
  projectID: string;
  tags: EventTag[];
  size: number;
  location: string | null;
  groupingConfig: {
    id: string;
    enhancements: string;
  };
  crashFile: IssueAttachment | null;
  fingerprints: string[];
  projectSlug?: string;
  oldestEventID?: string | null;
  latestEventID?: string | null;
  previousEventID?: string | null;
  nextEventID?: string | null;
  groupID?: string;
  context?: Record<string, any>;
  dateCreated?: string;
  device?: Record<string, any>;
  packages?: Record<string, string>;
  platform?: PlatformType;
  dateReceived: string;
  endTimestamp?: number;
  userReport?: any;
  sdk?: {
    name: string;
    version: string;
  } | null;
  sdkUpdates?: Array<SDKUpdatesSuggestion>;
  measurements?: Record<string, Measurement>;
  release?: Release | null;
}

export type EventTransaction = Omit<EventBase, 'entries' | 'type'> & {
  entries: (EntrySpans | EntryRequest)[];
  startTimestamp: number;
  endTimestamp: number;
  type: EventOrGroupType.TRANSACTION;
  title?: string;
  contexts?: {
    trace?: TraceContextType;
  };
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
export interface EventIdResponse {
  organizationSlug: string;
  projectSlug: string;
  groupId: string;
  eventId: string;
  event: Event;
}
