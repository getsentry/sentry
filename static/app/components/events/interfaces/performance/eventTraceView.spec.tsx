import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EntryType} from 'sentry/types/event';
import {IssueCategory, IssueTitle} from 'sentry/types/group';
import type {TraceEventResponse} from 'sentry/views/issueDetails/traceTimeline/useTraceTimelineEvents';
import {makeTraceError} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {EventTraceView} from './eventTraceView';

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;

describe('EventTraceView', () => {
  const traceId = 'this-is-a-good-trace-id';
  const {organization, project} = initializeData({
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
    MockApiClient.addMockResponse({
      url: '/subscriptions/org-slug/',
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/events-trace-meta/${traceId}/`,
      body: {
        errors: 1,
        performance_issues: 1,
        projects: 1,
        transactions: 1,
        transaction_child_count_map: new Array(20)
          .fill(0)
          .map((_, i) => [{'transaction.id': i.toString(), count: 1}]),
        span_count: 0,
        span_count_map: {},
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-trace/${traceId}/`,
      body: {
        transactions: new Array(20).fill(0).map((_, i) => [
          {
            project_slug: project.slug,
            event_id: i.toString(),
            children: [],
            sdk_name: '',
            start_timestamp: 0,
            timestamp: 1,
            transaction: 'transaction',
            'transaction.op': '',
            'transaction.status': '',
            performance_issues: [],
            errors: i === 5 ? [makeTraceError({event_id: 'issue-5'})] : [],
          },
        ]),
        orphan_errors: [makeTraceError()],
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

    expect(await screen.findByText('Trace')).toBeInTheDocument();
    expect(
      await screen.findByText('MaybeEncodingError: Error sending result')
    ).toBeInTheDocument();
  });

  it('still renders trace link for performance issues', async () => {
    const oneOtherIssueEvent: TraceEventResponse = {
      data: [
        {
          // In issuePlatform, the message contains the title and the transaction
          message: '/api/slow/ Slow DB Query SELECT "sentry_monitorcheckin"."monitor_id"',
          timestamp: '2024-01-24T09:09:03+00:00',
          'issue.id': 1000,
          project: project.slug,
          'project.name': project.name,
          title: 'Slow DB Query',
          id: 'abc',
          transaction: 'n/a',
          culprit: '/api/slow/',
          'event.type': '',
        },
      ],
      meta: {fields: {}, units: {}},
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: oneOtherIssueEvent,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    const perfGroup = GroupFixture({issueCategory: IssueCategory.PERFORMANCE});
    const perfEvent = EventFixture({
      occurrence: {
        type: 1001,
        issueTitle: IssueTitle.PERFORMANCE_SLOW_DB_QUERY,
      },
      entries: [
        {
          data: [],
          type: EntryType.SPANS,
        },
      ],
      contexts: {
        trace: {
          trace_id: traceId,
        },
      },
    });

    render(
      <EventTraceView group={perfGroup} event={perfEvent} organization={organization} />
    );
    expect(await screen.findByText('Trace Preview')).toBeInTheDocument();
    expect(
      await screen.findByRole('link', {name: 'View Full Trace'})
    ).toBeInTheDocument();
    expect(
      screen.getByText('One other issue appears in the same trace.')
    ).toBeInTheDocument();
  });

  it('does not render the trace preview if it has no transactions', async () => {
    MockApiClient.addMockResponse({
      url: '/subscriptions/org-slug/',
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/events-trace-meta/${traceId}/`,
      body: {
        errors: 0,
        performance_issues: 0,
        projects: 0,
        transactions: 0,
        transaction_child_count_map: [{'transaction.id': '1', count: 1}],
        span_count: 0,
        span_count_map: {},
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

    expect(await screen.findByText('Trace Preview')).toBeInTheDocument();
  });
});
