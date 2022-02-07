import {initializeOrg} from 'sentry-test/initializeOrg';

import {Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {
  ExampleSpan,
  ExampleTransaction,
  SuspectSpan,
} from 'sentry/utils/performance/suspectSpans/types';

export interface initializeDataSettings {
  features?: string[];
  project?: Project;
  projects?: Project[];
  query?: {};
}

export function initializeData(settings?: initializeDataSettings) {
  const _defaultProject = TestStubs.Project();
  const _settings = {
    query: {},
    features: [],
    projects: [_defaultProject],
    project: _defaultProject,
    ...settings,
  };
  const {query, features, projects, project} = _settings;

  const organization = TestStubs.Organization({
    features,
    projects,
  });
  const routerLocation: {query: {project?: number}} = {
    query: {
      ...query,
    },
  };
  if (settings?.project) {
    routerLocation.query.project = project;
  }
  const router = {
    location: routerLocation,
  };
  const initialData = initializeOrg({organization, projects, project, router});
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
