import {RouteComponentProps} from 'react-router';

import {Organization, Project} from 'sentry/types';
import {metric} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  createDefaultRule,
  createRuleFromEventView,
  createRuleFromWizardTemplate,
} from 'sentry/views/alerts/rules/metric/constants';
import {WizardRuleTemplate} from 'sentry/views/alerts/wizard/options';

import RuleForm from './ruleForm';

type RouteParams = {
  projectId?: string;
  ruleId?: string;
};

type Props = {
  eventView: EventView | undefined;
  organization: Organization;
  project: Project;
  userTeamIds: string[];
  sessionId?: string;
  wizardTemplate?: WizardRuleTemplate;
} & RouteComponentProps<RouteParams, {}>;

/**
 * Show metric rules form with an empty rule. Redirects to alerts list after creation.
 */
function MetricRulesCreate(props: Props) {
  function handleSubmitSuccess(data: any) {
    const {organization, project, router} = props;
    const alertRuleId: string | undefined = data
      ? (data.id as string | undefined)
      : undefined;

    metric.endTransaction({name: 'saveAlertRule'});
    const target = alertRuleId
      ? {
          pathname: `/organizations/${organization.slug}/alerts/rules/details/${alertRuleId}/`,
        }
      : {
          pathname: `/organizations/${organization.slug}/alerts/rules/`,
          query: {project: project.id},
        };
    router.push(normalizeUrl(target));
  }

  const {project, eventView, wizardTemplate, sessionId, userTeamIds, ...otherProps} =
    props;
  const defaultRule = eventView
    ? createRuleFromEventView(eventView)
    : wizardTemplate
    ? createRuleFromWizardTemplate(wizardTemplate)
    : createDefaultRule();

  const projectTeamIds = new Set(project.teams.map(({id}) => id));
  const defaultOwnerId = userTeamIds.find(id => projectTeamIds.has(id)) ?? null;
  defaultRule.owner = defaultOwnerId && `team:${defaultOwnerId}`;

  return (
    <RuleForm
      onSubmitSuccess={handleSubmitSuccess}
      rule={{...defaultRule, projects: [project.slug]}}
      sessionId={sessionId}
      project={project}
      userTeamIds={userTeamIds}
      eventView={eventView}
      {...otherProps}
    />
  );
}

export default MetricRulesCreate;
