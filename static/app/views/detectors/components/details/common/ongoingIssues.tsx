import {LinkButton} from 'sentry/components/core/button/linkButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import GroupList from 'sentry/components/issues/groupList';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {getUtcDateString} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type DetectorDetailsOngoingIssuesProps = {
  detector: Detector;
};

export function DetectorDetailsOngoingIssues({
  detector,
}: DetectorDetailsOngoingIssuesProps) {
  const organization = useOrganization();
  const query = `is:unresolved detector:${detector.id}`;
  const {selection} = usePageFilters();
  const queryParams = {
    query,
    project: detector.projectId,
    start: selection.datetime.start
      ? getUtcDateString(selection.datetime.start)
      : undefined,
    end: selection.datetime.end ? getUtcDateString(selection.datetime.end) : undefined,
    statsPeriod: selection.datetime.period,
  };

  return (
    <Section
      title={t('Ongoing Issues')}
      trailingItems={
        <LinkButton
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
