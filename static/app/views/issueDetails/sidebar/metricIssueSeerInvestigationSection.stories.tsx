import {Fragment, useState} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import * as Storybook from 'sentry/stories';
import type {Event} from 'sentry/types/event';
import type {Group, GroupOpenPeriod} from 'sentry/types/group';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  InvestigationAgenticDetailFixture,
  InvestigationHypothesesFixture,
  InvestigationOrchestrationFixture,
} from 'sentry/views/investigations/fixtures';
import type {
  InvestigationDetail,
  InvestigationOrchestration,
} from 'sentry/views/investigations/types';
import {MetricIssueSeerInvestigationSection} from 'sentry/views/issueDetails/sidebar/metricDetectorTriggeredSection';

const INVESTIGATION_ID = '4567';

const openPeriod: GroupOpenPeriod = {
  id: '1',
  start: '2026-09-30T10:00:00Z',
  end: null,
  duration: '1h',
  isOpen: true,
  lastChecked: '2026-09-30T11:00:00Z',
  activities: [],
};

// The section only reads the ids off these.
const group = {id: '1'} as Group;
const event = {eventID: 'event-1'} as Event;

type Fixtures = {
  investigation: InvestigationDetail;
  orchestration: InvestigationOrchestration;
};

/**
 * Answers every request the section makes from fixtures, polls included, so the
 * story never reaches the API. Per-query options outrank client defaults, which
 * is why this replaces `queryFn` after defaulting rather than setting a default.
 */
class FixtureQueryClient extends QueryClient {
  fixtures: Fixtures;

  constructor(fixtures: Fixtures) {
    super({defaultOptions: {queries: {retry: false}}});
    this.fixtures = fixtures;
  }

  respond(url: string): unknown {
    if (url.endsWith('/open-periods/')) {
      return [openPeriod];
    }
    if (url.endsWith('/investigations/candidates/')) {
      return {items: [{status: 'view', investigationId: INVESTIGATION_ID}]};
    }
    if (url.endsWith('/orchestration/')) {
      return this.fixtures.orchestration;
    }
    return this.fixtures.investigation;
  }

  override defaultQueryOptions: QueryClient['defaultQueryOptions'] = options => {
    const defaulted = super.defaultQueryOptions(options);
    const url = String(defaulted.queryKey[0]);
    const queryFn = () => Promise.resolve({json: this.respond(url), headers: {}});
    // Each fixture matches the response type of the query that asked for it.
    return {...defaulted, queryFn: queryFn as never};
  };
}

function SectionWithFixtures(fixtures: Fixtures) {
  const organization = useOrganization();
  const [queryClient] = useState(() => new FixtureQueryClient(fixtures));

  return (
    <OrganizationContext.Provider value={{...organization, openMembership: true}}>
      <QueryClientProvider client={queryClient}>
        <MetricIssueSeerInvestigationSection group={group} event={event} />
      </QueryClientProvider>
    </OrganizationContext.Provider>
  );
}

function runningInvestigation(
  orchestration: Partial<InvestigationOrchestration>
): Fixtures {
  return {
    investigation: InvestigationAgenticDetailFixture({
      id: INVESTIGATION_ID,
      blocks: [],
      orchestration: {
        phase: orchestration.phase ?? 'intake',
        status: orchestration.status ?? 'processing',
        heartbeatAt: '2026-09-30T11:00:00Z',
        notebookRevision: 1,
      },
    }),
    orchestration: InvestigationOrchestrationFixture({
      investigationId: INVESTIGATION_ID,
      ...orchestration,
    }),
  };
}

export default Storybook.story('Metric issue — Seer investigation section', story => {
  story('While the investigation is running', () => (
    <Fragment>
      <p>
        A metric issue's Seer Investigation section shows where a launched run has got to,
        using the same status line as the investigation page, until the summary is ready.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <SectionWithFixtures
          {...runningInvestigation({
            phase: 'broad_scan',
            status: 'processing',
            hypotheses: [],
          })}
        />
      </Storybook.Demo>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <SectionWithFixtures
          {...runningInvestigation({
            phase: 'investigating',
            status: 'processing',
            hypotheses: InvestigationHypothesesFixture(),
          })}
        />
      </Storybook.Demo>
    </Fragment>
  ));

  story('When the run stopped', () => (
    <Storybook.Demo direction="column" align="stretch" maxHeight="none">
      <SectionWithFixtures
        {...runningInvestigation({
          phase: 'failed',
          status: 'failed',
          errors: [
            {
              code: 'query_timeout',
              message: 'The metric query timed out.',
              retryable: false,
            },
          ],
        })}
      />
    </Storybook.Demo>
  ));

  story('Once the summary is ready', () => (
    <Storybook.Demo direction="column" align="stretch" maxHeight="none">
      <SectionWithFixtures
        investigation={InvestigationAgenticDetailFixture({
          id: INVESTIGATION_ID,
          blocks: [],
          summary: 'Errors rose across releases',
          summaryDescription: 'All active releases increased together.',
          orchestration: {
            phase: 'completed',
            status: 'completed',
            heartbeatAt: '2026-09-30T11:00:00Z',
            notebookRevision: 5,
          },
        })}
        orchestration={InvestigationOrchestrationFixture({
          investigationId: INVESTIGATION_ID,
          phase: 'completed',
          status: 'completed',
        })}
      />
    </Storybook.Demo>
  ));
});
