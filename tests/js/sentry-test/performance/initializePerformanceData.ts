import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import type {EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import type {
  ExampleSpan,
  ExampleTransaction,
  SuspectSpan,
} from 'sentry/utils/performance/suspectSpans/types';

export interface InitializeDataSettings {
  features?: string[];
  project?: any; // TODO(k-fish): Fix this project type.
  projects?: Project[];
  query?: {};
  selectedProject?: any;
}

export function initializeData(settings?: InitializeDataSettings) {
  const _defaultProject = ProjectFixture();
  const _settings = {
    query: {},
    features: [],
    projects: [_defaultProject],
    project: _defaultProject,
    ...settings,
  };
  const {query, features, projects, selectedProject: project} = _settings;

  const organization = OrganizationFixture({
    features,
  });
  const routerLocation: {query: {project?: string}} = {
    query: {
      ...query,
    },
  };
  if (settings?.selectedProject || settings?.project) {
    routerLocation.query.project = (project || settings?.project) as any;
  }
  const router = {
    location: routerLocation,
  };
  const initialData = initializeOrg({organization, projects, router});
  const location = initialData.router.location;
  const eventView = EventView.fromLocation(location);

  return {...initialData, location, eventView};
}

export const SAMPLE_SPANS = [
  {
    op: 'op1',
    group: 'aaaaaaaaaaaaaaaa',
    description: 'span-1',
    examples: [
      {
        id: 'abababababababab',
        description: 'span-1',
        spans: [{id: 'ababab11'}, {id: 'ababab22'}],
      },
      {
        id: 'acacacacacacacac',
        description: 'span-2',
        spans: [{id: 'acacac11'}, {id: 'acacac22'}],
      },
      {
        id: 'adadadadadadadad',
        description: 'span-3',
        spans: [{id: 'adadad11'}, {id: 'adadad22'}],
      },
    ],
  },
  {
    op: 'op2',
    group: 'bbbbbbbbbbbbbbbb',
    description: 'span-4',
    examples: [
      {
        id: 'bcbcbcbcbcbcbcbc',
        description: 'span-4',
        spans: [{id: 'bcbcbc11'}, {id: 'bcbcbc11'}],
      },
      {
        id: 'bdbdbdbdbdbdbdbd',
        description: 'span-5',
        spans: [{id: 'bdbdbd11'}, {id: 'bdbdbd22'}],
      },
      {
        id: 'bebebebebebebebe',
        description: 'span-6',
        spans: [{id: 'bebebe11'}, {id: 'bebebe22'}],
      },
    ],
  },
];

type SpanOpt = {
  id: string;
};

type ExampleOpt = {
  description: string;
  id: string;
  spans: SpanOpt[];
};

type SuspectOpt = {
  description: string;
  examples: ExampleOpt[];
  group: string;
  op: string;
};

function makeSpan(opt: SpanOpt): ExampleSpan {
  const {id} = opt;
  return {
    id,
    trace: 'trace',
    startTimestamp: 10100,
    finishTimestamp: 10200,
    exclusiveTime: 100,
  };
}

function makeExample(opt: ExampleOpt): ExampleTransaction {
  const {id, description, spans} = opt;
  return {
    id,
    description,
    startTimestamp: 10000,
    finishTimestamp: 12000,
    nonOverlappingExclusiveTime: 2000,
    spans: spans.map(makeSpan),
  };
}

export function makeSuspectSpan(opt: SuspectOpt): SuspectSpan {
  const {op, group, description, examples} = opt;
  return {
    op,
    group,
    description,
    frequency: 1,
    count: 1,
    avgOccurrences: 1,
    sumExclusiveTime: 5,
    p50ExclusiveTime: 1,
    p75ExclusiveTime: 2,
    p95ExclusiveTime: 3,
    p99ExclusiveTime: 4,
    examples: examples.map(makeExample),
  };
}

export function generateSuspectSpansResponse(opts?: {
  examples?: number;
  examplesOnly?: boolean;
}) {
  const {examples, examplesOnly} = opts ?? {};
  return SAMPLE_SPANS.map(sampleSpan => {
    const span = {...sampleSpan};
    if (defined(examples)) {
      span.examples = span.examples.slice(0, examples);
    }
    const suspectSpans = makeSuspectSpan(span);
    if (examplesOnly) {
      return {
        op: suspectSpans.op,
        group: suspectSpans.group,
        examples: suspectSpans.examples,
      };
    }
    return suspectSpans;
  });
}

export function generateSampleEvent(): EventTransaction {
  const event = {
    id: '2b658a829a21496b87fd1f14a61abf65',
    eventID: '2b658a829a21496b87fd1f14a61abf65',
    title: '/organizations/:orgId/discover/results/',
    type: 'transaction',
    startTimestamp: 1622079935.86141,
    endTimestamp: 1622079940.032905,
    contexts: {
      trace: {
        trace_id: '8cbbc19c0f54447ab702f00263262726',
        span_id: 'a000000000000000',
        op: 'pageload',
        status: 'unknown',
        type: 'trace',
      },
    },
    entries: [
      {
        data: [],
        type: EntryType.SPANS,
      },
    ],
  } as unknown as EventTransaction;

  return event;
}

export function generateSampleSpan(
  description: string | undefined,
  op: string | undefined,
  span_id: string,
  parent_span_id: string,
  event: EventTransaction
) {
  const span: RawSpanType = {
    start_timestamp: 1000,
    timestamp: 2000,
    description,
    op,
    span_id,
    parent_span_id,
    trace_id: '8cbbc19c0f54447ab702f00263262726',
    status: 'ok',
    tags: {
      'http.status_code': '200',
    },
    data: {},
  };

  if (!Array.isArray(event.entries[0]!.data)) {
    throw new Error('Event entries data is not an array');
  }

  const data = event.entries[0]!.data as RawSpanType[];
  data.push(span);
  return span;
}
