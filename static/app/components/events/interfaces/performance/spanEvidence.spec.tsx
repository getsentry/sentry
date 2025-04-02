import {EventFixture} from 'sentry-fixture/event';

import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {IssueTitle, IssueType} from 'sentry/types/group';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';
import {
  makeTraceError,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {SpanEvidenceSection} from './spanEvidence';

const {organization, project} = initializeData();

describe('spanEvidence', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders and attempts to render the trace preview', async () => {
    const traceId = 'trace-id';
    const event = EventFixture({
      contexts: {
        trace: {
          trace_id: traceId,
        },
      },
    });

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
        transaction_child_count_map: [[{'transaction.id': '0', count: 1}]],
        span_count: 0,
        span_count_map: {},
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-trace/${traceId}/`,
      method: 'GET',
      body: {
        transactions: [
          makeTransaction({
            'transaction.op': 'transaction-op-1',
            project_slug: 'project-slug-1',
            event_id: 'event-id-1',
            errors: [makeTraceError({event_id: 'issue-5'})],
          }),
        ],
        orphan_errors: [makeTraceError()],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/project-slug-1:event-id-1/`,
      method: 'GET',
      body: {
        entries: [{type: EntryType.SPANS, data: []}],
      },
    });

    render(
      <SpanEvidenceSection
        event={event as EventTransaction}
        organization={organization}
        projectSlug={project.slug}
      />,
      {organization}
    );

    // Verify that the trace preview is rendered
    expect(
      await screen.findByTestId('trace-virtualized-list', undefined, {timeout: 10_000})
    ).toBeInTheDocument();
  }, 10_000); // Increase timeout to 10 seconds

  it('renders settings button for issue with configurable thresholds', () => {
    const event = EventFixture({
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
    });

    render(
      <SpanEvidenceSection
        event={event as EventTransaction}
        organization={organization}
        projectSlug={project.slug}
      />,
      {organization}
    );

    expect(screen.getByText('Span Evidence')).toBeInTheDocument();

    const settingsBtn = screen.getByTestId('span-evidence-settings-btn');
    expect(settingsBtn).toBeInTheDocument();
    expect(settingsBtn).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/${project.slug}/performance/?issueType=${
        IssueType.PERFORMANCE_SLOW_DB_QUERY
      }#${sanitizeQuerySelector(IssueTitle.PERFORMANCE_SLOW_DB_QUERY)}`
    );
  });

  it('does not render settings button for issue without configurable thresholds', () => {
    const event = EventFixture({
      occurrence: {
        type: 2003, // profile_json_decode_main_thread
      },
      entries: [
        {
          data: [],
          type: EntryType.SPANS,
        },
      ],
    });

    render(
      <SpanEvidenceSection
        event={event as EventTransaction}
        organization={organization}
        projectSlug={project.slug}
      />,
      {organization}
    );

    expect(screen.getByText('Span Evidence')).toBeInTheDocument();

    const settingsBtn = screen.queryByTestId('span-evidence-settings-btn');
    expect(settingsBtn).not.toBeInTheDocument();
  });
});
