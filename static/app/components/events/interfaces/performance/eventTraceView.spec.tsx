import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EntryType} from 'sentry/types/event';
import type {TraceEventResponse} from 'sentry/views/issueDetails/traceTimeline/useTraceTimelineEvents';

import {EventTraceView} from './eventTraceView';

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;

jest.mock('screenfull', () => ({
  enabled: true,
  isFullscreen: false,
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

describe('EventTraceView', () => {
  const traceId = 'this-is-a-good-trace-id';
  const {organization, project} = initializeData({
    features: ['profiling', 'issue-details-always-show-trace'],
  });
  const group = GroupFixture();
  const event = EventFixture({
    contexts: {
      trace: {
        trace_id: traceId,
      },
    },
  });
  const issuePlatformBody: TraceEventResponse = {
    data: [],
    meta: {fields: {}, units: {}},
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: issuePlatformBody,
    });
  });

  it('renders a trace', async () => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/events-trace-meta/${traceId}/`,
      body: {
        errors: 1,
        performance_issues: 1,
        projects: 1,
        transactions: 1,
        transaction_child_count_map: [{'transaction.id': '1', count: 1}],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-trace/${traceId}/`,
      body: {
        transactions: [
          {
            project_slug: project.slug,
            event_id: '1',
            children: [],
            sdk_name: '',
            start_timestamp: 0,
            timestamp: 1,
            transaction: 'transaction',
            'transaction.op': '',
            'transaction.status': '',
            performance_issues: [],
            errors: [],
          },
        ],
        orphan_errors: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/${project.slug}:1/`,
      method: 'GET',
      body: {
        entries: [{type: EntryType.SPANS, data: []}],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-facets/`,
      method: 'GET',
      asyncDelay: 1,
      body: {},
    });

    render(<EventTraceView group={group} event={event} organization={organization} />);

    expect(await screen.findByText('Trace Connections')).toBeInTheDocument();
    expect(await screen.findByText('transaction')).toBeInTheDocument();
  });

  it('does not render the trace preview if it has no transactions', async () => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/events-trace-meta/${traceId}/`,
      body: {
        errors: 0,
        performance_issues: 0,
        projects: 0,
        transactions: 0,
        transaction_child_count_map: [{'transaction.id': '1', count: 1}],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-trace/${traceId}/`,
      body: {
        transactions: [],
        orphan_errors: [],
      },
    });

    render(<EventTraceView group={group} event={event} organization={organization} />);

    expect(await screen.findByText('Trace Connections')).toBeInTheDocument();
    expect(
      await screen.findByRole('link', {name: 'View Full Trace'})
    ).toBeInTheDocument();
  });
});
