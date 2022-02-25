import {RouteComponentProps} from 'react-router';

import {Organization, Project} from 'sentry/types';
import {metric} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {
  createDefaultRule,
  createRuleFromEventView,
  createRuleFromWizardTemplate,
} from 'sentry/views/alerts/incidentRules/constants';
import {WizardRuleTemplate} from 'sentry/views/alerts/wizard/options';

import RuleForm from './ruleForm';

interface RouteParams {
  orgId: string;
  projectId: string;
  ruleId?: string;
}

interface IncidentRulesCreateProps extends RouteComponentProps<RouteParams, {}> {
  eventView: EventView | undefined;
  organization: Organization;
  project: Project;
  userTeamIds: string[];
  isCustomMetric?: boolean;
  sessionId?: string;
  wizardTemplate?: WizardRuleTemplate;
}

/**
 * Show metric rules form with an empty rule. Redirects to alerts list after creation.
 */
function IncidentRulesCreate(props: IncidentRulesCreateProps) {
  function handleSubmitSuccess() {
    const {router, project} = props;
    const {orgId} = props.params;
    metric.endTransaction({name: 'saveAlertRule'});
    router.push({
      pathname: `/organizations/${orgId}/alerts/rules/`,
      query: {project: project.id},
    });
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
      {...otherProps}
    />
  );
}

export default IncidentRulesCreate;
