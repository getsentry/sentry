import {LinkButton} from '@sentry/scraps/button';

import ErrorBoundary from 'sentry/components/errorBoundary';
import GroupList from 'sentry/components/issues/groupList';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {getUtcDateString} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';

type DetectorDetailsOngoingIssuesProps = {
  // The time range used for the issues query.
  // When null, the query uses 90d as the stats period.
  dateTimeSelection: PageFilters['datetime'] | null;
  detector: Detector;
};

const DEFAULT_STATS_PERIOD = '90d';

export function DetectorDetailsOngoingIssues({
  detector,
  dateTimeSelection,
}: DetectorDetailsOngoingIssuesProps) {
  const organization = useOrganization();
  const query = `is:unresolved detector:${detector.id}`;
  const {start, end, period} = dateTimeSelection ?? {period: DEFAULT_STATS_PERIOD};

  const queryParams = {
    query,
    project: detector.projectId,
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
    statsPeriod: period ?? undefined,
  };

  return (
    <Section
      title={t('Ongoing Issues')}
      trailingItems={
        <LinkButton
          data-test-id="view-all-ongoing-issues-button"
          size="xs"
          to={{
            pathname: `/organizations/${organization.slug}/issues/`,
            query: queryParams,
          }}
        >
          {t('View All')}
        </LinkButton>
      }
    >
      <ErrorBoundary mini>
        <div>
          <GroupList numPlaceholderRows={5} queryParams={{...queryParams, limit: 5}} />
        </div>
      </ErrorBoundary>
    </Section>
  );
}
