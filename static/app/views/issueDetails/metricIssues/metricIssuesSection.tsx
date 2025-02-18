import {LinkButton} from 'sentry/components/button';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import RelatedIssues from 'sentry/views/alerts/rules/metric/details/relatedIssues';
import RelatedTransactions from 'sentry/views/alerts/rules/metric/details/relatedTransactions';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import {isCrashFreeAlert} from 'sentry/views/alerts/rules/metric/utils/isCrashFreeAlert';
import {useMetricRule} from 'sentry/views/alerts/rules/metric/utils/useMetricRule';
import {
  useMetricIssueAlertId,
  useMetricTimePeriod,
} from 'sentry/views/issueDetails/metricIssues/utils';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

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
  const timePeriod = useMetricTimePeriod({openPeriod: group.openPeriods?.[0]});

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
      <InterimSection
        title={t('Correlated Issues')}
        type={SectionKey.CORRELATED_ISSUES}
        help={t('A list of issues that are correlated with this event')}
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
      </InterimSection>
    );
  }

  if ([Dataset.TRANSACTIONS, Dataset.GENERIC_METRICS].includes(dataset)) {
    return (
      <InterimSection
        title={t('Correlated Transactions')}
        type={SectionKey.CORRELATED_TRANSACTIONS}
        help={t('A list of transactions that are correlated with this event')}
      >
        <RelatedTransactions
          organization={organization}
          location={location}
          rule={rule}
          projects={[project]}
          timePeriod={timePeriod}
          filter={extractEventTypeFilterFromRule(rule)}
        />
      </InterimSection>
    );
  }

  return null;
}
