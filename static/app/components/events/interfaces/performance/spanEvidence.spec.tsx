import {EventFixture} from 'sentry-fixture/event';

import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {IssueTitle, IssueType} from 'sentry/types/group';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';

import {SpanEvidenceSection} from './spanEvidence';

const {organization, project} = initializeData();

describe('spanEvidence', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

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
