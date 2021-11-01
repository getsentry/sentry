import {DebugImage} from 'app/components/events/interfaces/debugMeta/types';
import {TraceContextType} from 'app/components/events/interfaces/spans/types';

import {RawCrumb} from './breadcrumbs';
import {Thread} from './events';
import {StacktraceType} from './stacktrace';
import {
  EventMetadata,
  EventOrGroupType,
  ExceptionType,
  Frame,
  IssueAttachment,
  PlatformType,
  Release,
  SDKUpdatesSuggestion,
} from '.';

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
  type: EntryType.DEBUGMETA;
  data: {
    images: Array<DebugImage>;
  };
};

type EntryBreadcrumbs = {
  type: EntryType.BREADCRUMBS;
  data: {
    values: Array<RawCrumb>;
  };
};

export type EntryThreads = {
  type: EntryType.THREADS;
  data: {
    values?: Array<Thread>;
  };
};

export type EntryException = {
  type: EntryType.EXCEPTION;
  data: ExceptionType;
};

type EntryStacktrace = {
  type: EntryType.STACKTRACE;
  data: StacktraceType;
};

type EntrySpans = {
  type: EntryType.SPANS;
  data: any; // data is not used
};

type EntryMessage = {
  type: EntryType.MESSAGE;
  data: {
    formatted: string;
    params?: Record<string, any> | any[];
  };
};

export type EntryRequest = {
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
};

type EntryTemplate = {
  type: EntryType.TEMPLATE;
  data: Frame;
};

type EntryCsp = {
  type: EntryType.CSP;
  data: Record<string, any>;
};

type EntryGeneric = {
  type: EntryType.EXPECTCT | EntryType.EXPECTSTAPLE | EntryType.HPKP;
  data: Record<string, any>;
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
  version: number;
  build?: string;
  name?: string;
};

type DeviceContext = {
  arch: string;
  family: string;
  model: string;
  type: string;
};

type OSContext = {
  kernel_version: string;
  version: string;
  type: string;
  build: string;
  name: string;
};

type EventContexts = {
  runtime?: RuntimeContext;
  trace?: TraceContextType;
  device?: DeviceContext;
  os?: OSContext;
  client_os?: OSContext;
};

export type Measurement = {value: number};

export type EventTag = {key: string; value: string};

export type EventUser = {
  username?: string | null;
  name?: string | null;
  ip_address?: string;
  email?: string;
  id?: string;
  data?: string | null;
};

type EventBase = {
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
};

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
