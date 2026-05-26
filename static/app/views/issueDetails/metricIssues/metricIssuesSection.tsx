import {LinkButton} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {RelatedIssues} from 'sentry/views/alerts/rules/metric/details/relatedIssues';
import {RelatedTransactions} from 'sentry/views/alerts/rules/metric/details/relatedTransactions';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import {isCrashFreeAlert} from 'sentry/views/alerts/rules/metric/utils/isCrashFreeAlert';
import {useMetricRule} from 'sentry/views/alerts/rules/metric/utils/useMetricRule';
import {useOpenPeriods} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {
  useMetricIssueAlertId,
  useMetricTimePeriod,
} from 'sentry/views/issueDetails/metricIssues/utils';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

interface MetricIssuesSectionProps {
  group: Group;
  organization: Organization;
  project: Project;
}

export function MetricIssuesSection({
  organization,
  group,
  project,
}: MetricIssuesSectionProps) {
  const location = useLocation();

  const ruleId = useMetricIssueAlertId({groupId: group.id});
  const {data: rule} = useMetricRule(
    {
      orgSlug: organization.slug,
      ruleId: ruleId ?? '',
      query: {
        expand: 'latestIncident',
      },
    },
    {
      staleTime: Infinity,
      retry: false,
      enabled: !!ruleId,
    }
  );
  const {data: openPeriods} = useOpenPeriods({groupId: group.id});
  const timePeriod = useMetricTimePeriod({openPeriod: openPeriods?.[0]});

  if (!rule || !timePeriod) {
    return null;
  }

  const {dataset, query} = rule;

  if ([Dataset.METRICS, Dataset.SESSIONS, Dataset.ERRORS].includes(dataset)) {
    const queryParams = {
      start: timePeriod.start,
      end: timePeriod.end,
      groupStatsPeriod: 'auto',
      ...(rule.environment ? {environment: rule.environment} : {}),
      sort: rule.aggregate === 'count_unique(user)' ? 'user' : 'freq',
      query,
      project: [project.id],
    };
    const issueSearch = {
      pathname: `/organizations/${organization.slug}/issues/`,
      query: queryParams,
    };

    const actions = (
      <LinkButton data-test-id="issues-open" size="xs" to={issueSearch}>
        {t('Open in Issues')}
      </LinkButton>
    );

    return (
      <FoldSection
        sectionKey={SectionKey.CORRELATED_ISSUES}
        title={t('Correlated Issues')}
        actions={actions}
      >
        <RelatedIssues
          organization={organization}
          rule={rule}
          projects={[project]}
          timePeriod={timePeriod}
          query={
            dataset === Dataset.ERRORS
              ? // Not using (query) AND (event.type:x) because issues doesn't support it yet
                `${extractEventTypeFilterFromRule(rule)} ${query}`.trim()
              : isCrashFreeAlert(dataset)
                ? `${query} error.unhandled:true`.trim()
                : undefined
          }
          skipHeader
        />
      </FoldSection>
    );
  }

  if ([Dataset.TRANSACTIONS, Dataset.GENERIC_METRICS].includes(dataset)) {
    return (
      <FoldSection
        sectionKey={SectionKey.CORRELATED_TRANSACTIONS}
        title={t('Correlated Transactions')}
      >
        <RelatedTransactions
          organization={organization}
          location={location}
          rule={rule}
          projects={[project]}
          timePeriod={timePeriod}
          filter={extractEventTypeFilterFromRule(rule)}
        />
      </FoldSection>
    );
  }

  return null;
}
