import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {
  IssueAlertActionType,
  IssueAlertRule,
  RuleActionsCategories,
} from 'sentry/types/alerts';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {Dataset, MetricRule} from 'sentry/views/alerts/rules/metric/types';

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
  const actions = rule.triggers.map(trigger => trigger.actions).flat();
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

export function shouldUseErrorsDiscoverDataset(query: string, dataset: Dataset) {
  return dataset === Dataset.ERRORS && query?.includes('is:unresolved');
}
