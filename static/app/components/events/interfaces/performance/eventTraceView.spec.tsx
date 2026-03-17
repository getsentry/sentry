import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EntryType} from 'sentry/types/event';
import type {TraceEventResponse} from 'sentry/views/issueDetails/traceTimeline/useTraceTimelineEvents';
import {
  makeEAPError,
  makeEAPSpan,
  makeEAPTrace,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {EventTraceView} from './eventTraceView';

describe('EventTraceView', () => {
  const traceId = 'this-is-a-good-trace-id';
  const {organization} = initializeData({
    features: ['profiling'],
  });
  const group = GroupFixture();
  const event = EventFixture({
    contexts: {
      trace: {
        trace_id: traceId,
      },
    },
    eventID: 'issue-5',
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
    const size = 20;
    MockApiClient.addMockResponse({
      url: '/customers/org-slug/',
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/trace/${traceId}/`,
      body: makeEAPTrace([
        ...Array.from({length: size}, (_, i) =>
          makeEAPSpan({
            op: `transaction-op-${i + 1}`,
            project_slug: `project-slug-${i + 1}`,
            event_id: `event-id-${i + 1}`,
            is_transaction: true,
            errors:
              i === 0
                ? [
                    makeEAPError({
                      event_id: 'issue-5',
                      description: 'MaybeEncodingError: Error sending result',
                    }),
                  ]
                : [],
          })
        ),
        makeEAPError({description: 'MaybeEncodingError: Error sending result'}),
      ]),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/project-slug-1:event-id-1/`,
      method: 'GET',
      body: {
        entries: [{type: EntryType.SPANS, data: []}],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/project-slug-1:event-id-1/?averageColumn=span.self_time&averageColumn=span.duration`,
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

    expect(await screen.findByText('Trace')).toBeInTheDocument();

    // Renders the transactions
    expect(await screen.findByText('transaction-op-1')).toBeInTheDocument();
    expect(await screen.findByText('transaction-op-2')).toBeInTheDocument();
    expect(await screen.findByText('transaction-op-3')).toBeInTheDocument();
    expect(await screen.findByText('transaction-op-4')).toBeInTheDocument();

    // Only renders part of the trace. "x hidden spans" for some reason is cut off in jsdom
    expect(document.querySelectorAll('.TraceRow')).toHaveLength(7);
  });

  it('does not render the trace preview if it has no transactions', async () => {
    MockApiClient.addMockResponse({
      url: '/customers/org-slug/',
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/trace/${traceId}/`,
      body: makeEAPTrace([]),
    });

    render(<EventTraceView group={group} event={event} organization={organization} />);

    expect(await screen.findByText('Trace Preview')).toBeInTheDocument();
  });
});
