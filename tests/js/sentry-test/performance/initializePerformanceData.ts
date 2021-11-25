import {initializeOrg} from 'sentry-test/initializeOrg';

import {Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {
  ExampleSpan,
  ExampleTransaction,
  SuspectSpan,
} from 'sentry/utils/performance/suspectSpans/types';

export function initializeData(settings?: {
  query?: {};
  features?: string[];
  projects?: Project[];
  project?: Project;
}) {
  const _defaultProject = TestStubs.Project();
  const _settings = {
    query: {},
    features: [],
    projects: [_defaultProject],
    project: _defaultProject,
    ...settings,
  };
  const {query, features} = _settings;

  const projects = [TestStubs.Project()];
  const [project] = projects;

  const organization = TestStubs.Organization({
    features,
    projects,
  });
  const router = {
    location: {
      query: {
        ...query,
      },
    },
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
    ],
  },
  {
    op: 'op2',
    group: 'bbbbbbbbbbbbbbbb',
    examples: [
      {
        id: 'bcbcbcbcbcbcbcbc',
        description: 'span-3',
        spans: [{id: 'bcbcbc11'}, {id: 'bcbcbc11'}],
      },
      {
        id: 'bdbdbdbdbdbdbdbd',
        description: 'span-4',
        spans: [{id: 'bdbdbd11'}, {id: 'bdbdbd22'}],
      },
    ],
  },
];

type SpanOpt = {
  id: string;
};

type ExampleOpt = {
  id: string;
  description: string;
  spans: SpanOpt[];
};

type SuspectOpt = {
  op: string;
  group: string;
  examples: ExampleOpt[];
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

function makeSuspectSpan(opt: SuspectOpt): SuspectSpan {
  const {op, group, examples} = opt;
  return {
    projectId: 1,
    project: 'bar',
    transaction: 'transaction-1',
    op,
    group,
    frequency: 1,
    count: 1,
    avgOccurrences: 1,
    sumExclusiveTime: 1,
    p50ExclusiveTime: 1,
    p75ExclusiveTime: 1,
    p95ExclusiveTime: 1,
    p99ExclusiveTime: 1,
    examples: examples.map(makeExample),
  };
}

export function generateSuspectSpansResponse(opts?: {examples?: number}) {
  const {examples} = opts ?? {};
  return SAMPLE_SPANS.map(sampleSpan => {
    const span = {...sampleSpan};
    if (defined(examples)) {
      span.examples = span.examples.slice(0, examples);
    }
    return makeSuspectSpan(span);
  });
}
