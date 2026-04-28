import {EventFixture} from 'sentry-fixture/event';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AggregateSpanDiff} from './aggregateSpanDiff';

const BREAKPOINT_TIMESTAMP = 1706745600; // 2024-02-01T00:00:00Z

const defaultEvent = EventFixture({
  occurrence: {
    id: '1',
    eventId: 'abc123',
    fingerprint: ['fingerprint'],
    issueTitle: 'Transaction Regression',
    subtitle: '',
    resourceId: '',
    evidenceData: {
      transaction: '/api/endpoint',
      breakpoint: BREAKPOINT_TIMESTAMP,
    },
    evidenceDisplay: [],
    type: 2001,
    detectionTime: new Date(BREAKPOINT_TIMESTAMP * 1000).toISOString(),
  },
});

const defaultProject = ProjectFixture();

describe('AggregateSpanDiff', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    // Spans endpoint is always queried first (primary data source)
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'span.op': 'db',
            'span.group': 'abc123',
            'span.description': 'SELECT * FROM users',
            [`regression_score(span.self_time,${BREAKPOINT_TIMESTAMP})`]: 0.9,
            [`avg_by_timestamp(span.self_time,less,${BREAKPOINT_TIMESTAMP})`]: 10000,
            [`avg_by_timestamp(span.self_time,greater,${BREAKPOINT_TIMESTAMP})`]: 20000,
            [`epm_by_timestamp(less,${BREAKPOINT_TIMESTAMP})`]: 100.0,
            [`epm_by_timestamp(greater,${BREAKPOINT_TIMESTAMP})`]: 90.0,
          },
        ],
      },
    });
  });

  it('renders the Potential Causes section with span data', async () => {
    render(<AggregateSpanDiff event={defaultEvent} project={defaultProject} />);

    expect(await screen.findByText('SELECT * FROM users')).toBeInTheDocument();
    expect(screen.getByText('db')).toBeInTheDocument();
  });

  it('renders empty state when no spans are returned', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });

    render(<AggregateSpanDiff event={defaultEvent} project={defaultProject} />);

    expect(
      await screen.findByText('No results found for your query')
    ).toBeInTheDocument();
  });

  it('falls back to RCA endpoint when spans query fails', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      statusCode: 500,
      body: {detail: 'Internal Server Error'},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-root-cause-analysis/',
      body: [
        {
          span_op: 'db',
          span_group: 'abc123',
          span_description: 'SELECT * FROM users',
          score: 0.9,
          p95_before: 10.0,
          p95_after: 20.0,
          spm_before: 100.0,
          spm_after: 90.0,
        },
      ],
    });

    render(<AggregateSpanDiff event={defaultEvent} project={defaultProject} />);

    expect(await screen.findByText('SELECT * FROM users')).toBeInTheDocument();
    expect(screen.getByText('db')).toBeInTheDocument();
  });
});
