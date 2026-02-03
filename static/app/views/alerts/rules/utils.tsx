import * as qs from 'query-string';

import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {TIME_WINDOW_TO_INTERVAL} from 'sentry/views/alerts/utils/timePeriods';
import type {AlertType} from 'sentry/views/alerts/wizard/options';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {LOGS_QUERY_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

export function getProjectOptions({
  organization,
  projects,
  isFormDisabled,
}: {
  isFormDisabled: boolean;
  organization: Organization;
  projects: Project[];
}) {
  const hasOrgAlertWrite = organization.access.includes('alerts:write');
  const hasOrgWrite = organization.access.includes('org:write');
  const hasOpenMembership = organization.features.includes('open-membership');

  // If form is enabled, we want to limit to the subset of projects which the
  // user can create/edit alerts.
  const projectWithWrite =
    isFormDisabled || hasOrgAlertWrite
      ? projects
      : projects.filter(project => project.access.includes('alerts:write'));
  const myProjects = projectWithWrite.filter(project => project.isMember);
  const allProjects = projectWithWrite.filter(project => !project.isMember);

  const myProjectOptions = myProjects.map(myProject => ({
    value: myProject.id,
    label: myProject.slug,
    leadingItems: renderIdBadge(myProject),
  }));

  const openMembershipProjects = [
    {
      label: t('My Projects'),
      options: myProjectOptions,
    },
    {
      label: t('All Projects'),
      options: allProjects.map(allProject => ({
        value: allProject.id,
        label: allProject.slug,
        leadingItems: renderIdBadge(allProject),
      })),
    },
  ];

  return hasOpenMembership || hasOrgWrite || isActiveSuperuser()
    ? openMembershipProjects
    : myProjectOptions;
}

function renderIdBadge(project: Project) {
  return (
    <IdBadge
      project={project}
      avatarProps={{consistentWidth: true}}
      avatarSize={18}
      disableLink
      hideName
    />
  );
}

export function shouldUseErrorsDiscoverDataset(
  query: string,
  dataset: Dataset,
  organization: Organization
) {
  if (!hasDatasetSelector(organization)) {
    return dataset === Dataset.ERRORS && query?.includes('is:unresolved');
  }

  return dataset === Dataset.ERRORS;
}

export function getAlertRuleExploreUrl({
  rule,
  organization,
  timePeriod,
  projectId,
}: {
  organization: Organization;
  projectId: string;
  rule: MetricRule;
  timePeriod: TimePeriodType;
}) {
  if (rule.dataset !== Dataset.EVENTS_ANALYTICS_PLATFORM) {
    return '';
  }

  const interval =
    TIME_WINDOW_TO_INTERVAL[rule.timeWindow as keyof typeof TIME_WINDOW_TO_INTERVAL];

  return getExploreUrl({
    organization,
    selection: {
      datetime: {
        period: timePeriod.usingPeriod
          ? timePeriod.period === '9998m'
            ? '7d'
            : timePeriod.period
          : null,
        start: timePeriod.usingPeriod ? null : timePeriod.start,
        end: timePeriod.usingPeriod ? null : timePeriod.end,
        utc: timePeriod.utc || null,
      },
      environments: rule.environment ? [rule.environment] : [],
      projects: [parseInt(projectId, 10)],
    },
    interval,
    visualize: [
      {
        chartType: ChartType.LINE,
        yAxes: [rule.aggregate],
      },
    ],
    query: rule.query,
  });
}

export function getAlertRuleLogsUrl({
  rule,
  organization,
  timePeriod,
  projectId,
}: {
  organization: Organization;
  projectId: string;
  rule: MetricRule;
  timePeriod: TimePeriodType;
}) {
  if (
    rule.dataset !== Dataset.EVENTS_ANALYTICS_PLATFORM ||
    !rule.eventTypes?.includes(EventTypes.TRACE_ITEM_LOG)
  ) {
    return '';
  }

  const basePath = normalizeUrl(`/organizations/${organization.slug}/explore/logs/`);

  const queryParams: Record<string, any> = {
    project: [parseInt(projectId, 10)],
    environment: rule.environment,
    [LOGS_QUERY_KEY]: rule.query,
  };

  if (timePeriod.usingPeriod) {
    queryParams.statsPeriod = timePeriod.period === '9998m' ? '7d' : timePeriod.period;
  } else {
    queryParams.start = timePeriod.start;
    queryParams.end = timePeriod.end;
    queryParams.utc = timePeriod.utc;
  }

  if (rule.aggregate) {
    const parsed = parseFunction(rule.aggregate);
    if (parsed) {
      queryParams.logsAggregate = parsed.name;
      queryParams.logsAggregateParam = parsed.arguments[0];
    }
  }

  return `${basePath}` + `?${qs.stringify(queryParams, {skipNull: true})}`;
}

export function isEapAlertType(alertType?: AlertType) {
  if (!defined(alertType)) {
    return false;
  }
  return [
    'eap_metrics',
    'trace_item_throughput',
    'trace_item_duration',
    'trace_item_failure_rate',
    'trace_item_lcp',
    'trace_item_logs',
    'trace_item_metrics',
  ].includes(alertType);
}

/**
 * Converts frontend-only alert types to their backend equivalents.
 * `trace_item_logs` and `trace_item_metrics` are frontend-only types
 * that should be sent to the backend as `eap_metrics`.
 */
export function getBackendAlertType(alertType: AlertType): AlertType {
  if (alertType === 'trace_item_logs' || alertType === 'trace_item_metrics') {
    return 'eap_metrics';
  }
  return alertType;
}
