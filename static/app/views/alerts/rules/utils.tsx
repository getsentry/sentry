import * as qs from 'query-string';

import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import type {IssueAlertRule} from 'sentry/types/alerts';
import {IssueAlertActionType, RuleActionsCategories} from 'sentry/types/alerts';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {TIME_WINDOW_TO_INTERVAL} from 'sentry/views/alerts/rules/metric/triggers/chart';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
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

export function getRuleActionCategory(rule: IssueAlertRule) {
  const numDefaultActions = rule.actions.filter(
    action => action.id === IssueAlertActionType.NOTIFY_EMAIL
  ).length;

  switch (numDefaultActions) {
    // Are all actions default actions?
    case rule.actions.length:
      return RuleActionsCategories.ALL_DEFAULT;
    // Are none of the actions default actions?
    case 0:
      return RuleActionsCategories.NO_DEFAULT;
    default:
      return RuleActionsCategories.SOME_DEFAULT;
  }
}

export function getAlertRuleActionCategory(rule: MetricRule) {
  const actions = rule.triggers.flatMap(trigger => trigger.actions);
  const numDefaultActions = actions.filter(action => action.type === 'email').length;

  switch (numDefaultActions) {
    // Are all actions default actions?
    case actions.length:
      return RuleActionsCategories.ALL_DEFAULT;
    // Are none of the actions default actions?
    case 0:
      return RuleActionsCategories.NO_DEFAULT;
    default:
      return RuleActionsCategories.SOME_DEFAULT;
  }
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

export function getExploreUrl({
  rule,
  orgSlug,
  period,
  projectId,
}: {
  orgSlug: string;
  period: string;
  projectId: string;
  rule: MetricRule;
}) {
  if (rule.dataset !== Dataset.EVENTS_ANALYTICS_PLATFORM) {
    return '';
  }
  const visualize = {
    chartType: ChartType.LINE,
    yAxes: [rule.aggregate],
  };
  const interval = TIME_WINDOW_TO_INTERVAL[rule.timeWindow];
  const queryParams = {
    dataset: DiscoverDatasets.SPANS_EAP_RPC,
    query: rule.query,
    visualize: JSON.stringify(visualize),
    interval,
    statsPeriod: period,
    project: projectId,
    environment: rule.environment,
  };
  return normalizeUrl(`/organizations/${orgSlug}/traces/?${qs.stringify(queryParams)}`);
}
