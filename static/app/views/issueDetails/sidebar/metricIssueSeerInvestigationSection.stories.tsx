import {Fragment, useMemo} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import type {Group, GroupOpenPeriod} from 'sentry/types/group';
import {IssueCategory, IssueType} from 'sentry/types/group';
import type {Event} from 'sentry/types/event';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MetricIssueSeerInvestigationSection} from 'sentry/views/issueDetails/sidebar/metricDetectorTriggeredSection';
import {InvestigationBreachedMetricDetailFixture} from 'sentry/views/investigations/fixtures';
import {
  InvestigationsStoryProviders,
  seedInvestigationCandidates,
  seedInvestigationDetail,
  seedOpenPeriods,
} from 'sentry/views/investigations/storyHelpers';
import type {InvestigationCandidate} from 'sentry/views/investigations/types';

const GROUP_ID = '123';
const EVENT_ID = 'event-1';
const OPEN_PERIOD_ID = '456';

const openPeriod: GroupOpenPeriod = {
  id: OPEN_PERIOD_ID,
  start: '2026-08-17T10:00:00Z',
  end: '2026-08-17T10:15:00Z',
  duration: '15m',
  isOpen: false,
  activities: [],
  lastChecked: '2026-08-17T10:15:00Z',
};

const group = {
  id: GROUP_ID,
  issueType: IssueType.METRIC_ISSUE,
  issueCategory: IssueCategory.METRIC,
} as Group;

const event = {
  id: EVENT_ID,
  eventID: EVENT_ID,
} as Event;

function SectionExample({
  label,
  children,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Stack gap="sm" maxWidth="360px">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

function SeerInvestigationStory({
  candidate,
  investigation,
}: {
  candidate: InvestigationCandidate;
  investigation?: ReturnType<typeof InvestigationBreachedMetricDetailFixture>;
}) {
  const organization = useOrganization();
  const source = {
    type: 'metric_open_period' as const,
    ref: {groupId: GROUP_ID, openPeriodId: OPEN_PERIOD_ID},
  };
  const apiResponses = useMemo(() => {
    const responses = [
      {
        url: `/organizations/${organization.slug}/open-periods/`,
        response: {body: [openPeriod]},
      },
      {
        url: `/organizations/${organization.slug}/investigations/candidates/`,
        method: 'POST',
        response: {body: {items: [candidate]}},
      },
    ];
    if (investigation) {
      responses.push({
        url: `/organizations/${organization.slug}/investigations/${investigation.id}/`,
        response: {body: investigation},
      });
    }
    return responses;
  }, [candidate, investigation, organization.slug]);

  return (
    <InvestigationsStoryProviders
      apiResponses={apiResponses}
      seed={(queryClient, org) => {
        seedOpenPeriods(
          queryClient,
          org,
          {groupId: GROUP_ID, eventId: EVENT_ID, limit: 1},
          [openPeriod]
        );
        seedInvestigationCandidates(queryClient, org.slug, [source], [candidate]);
        if (investigation) {
          seedInvestigationDetail(queryClient, org.slug, investigation);
        }
      }}
    >
      <MetricIssueSeerInvestigationSection group={group} event={event} />
    </InvestigationsStoryProviders>
  );
}

export default Storybook.story('Metric Issue Seer Investigation', story => {
  story('Launch investigation', () => (
    <Fragment>
      <p>
        Metric issue sidebar entry point when no investigation exists yet for the open
        period.
      </p>
      <SectionExample label="candidate status=investigate">
        <SeerInvestigationStory candidate={{status: 'investigate'}} />
      </SectionExample>
    </Fragment>
  ));

  story('View existing investigation with summary', () => {
    const investigation = InvestigationBreachedMetricDetailFixture({
      id: '4567',
    });

    return (
      <SectionExample label="candidate status=view + completed summary">
        <SeerInvestigationStory
          candidate={{status: 'view', investigationId: investigation.id}}
          investigation={investigation}
        />
      </SectionExample>
    );
  });

  story('View investigation while summary is still generating', () => {
    const investigation = InvestigationBreachedMetricDetailFixture({
      id: '4567',
      summary: null,
      summaryDescription: null,
      titleGeneration: {status: 'running'},
    });

    return (
      <SectionExample label="existing investigation, summary incomplete">
        <SeerInvestigationStory
          candidate={{status: 'view', investigationId: investigation.id}}
          investigation={investigation}
        />
      </SectionExample>
    );
  });

  story('Unavailable candidate', () => (
    <SectionExample label="candidate status=unavailable">
      <SeerInvestigationStory candidate={{status: 'unavailable'}} />
    </SectionExample>
  ));
});
