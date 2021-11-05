import {RouteComponentProps} from 'react-router';

import {Organization, Project} from 'app/types';
import {metric} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {
  createDefaultRule,
  createRuleFromEventView,
  createRuleFromWizardTemplate,
} from 'app/views/alerts/incidentRules/constants';
import {WizardRuleTemplate} from 'app/views/alerts/wizard/options';

import RuleForm from './ruleForm';

type RouteParams = {
  orgId: string;
  projectId: string;
  ruleId?: string;
};

type Props = {
  organization: Organization;
  project: Project;
  eventView: EventView | undefined;
  userTeamIds: string[];
  wizardTemplate?: WizardRuleTemplate;
  sessionId?: string;
  isCustomMetric?: boolean;
} & RouteComponentProps<RouteParams, {}>;

/**
 * Show metric rules form with an empty rule. Redirects to alerts list after creation.
 */
function IncidentRulesCreate(props: Props) {
  function handleSubmitSuccess() {
    const {router} = props;
    const {orgId} = props.params;

    metric.endTransaction({name: 'saveAlertRule'});
    router.push(`/organizations/${orgId}/alerts/rules/`);
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
