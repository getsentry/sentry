import {Component} from 'react';
import {RouteComponentProps} from 'react-router';

import {Organization, Project, Team} from 'app/types';
import {metric} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import withTeams from 'app/utils/withTeams';
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
  teams: Team[];
  wizardTemplate?: WizardRuleTemplate;
  sessionId?: string;
  isCustomMetric?: boolean;
} & RouteComponentProps<RouteParams, {}>;

/**
 * Show metric rules form with an empty rule. Redirects to alerts list after creation.
 */
class IncidentRulesCreate extends Component<Props> {
  handleSubmitSuccess = () => {
    const {router} = this.props;
    const {orgId} = this.props.params;

    metric.endTransaction({name: 'saveAlertRule'});
    router.push(`/organizations/${orgId}/alerts/rules/`);
  };

  render() {
    const {project, eventView, wizardTemplate, sessionId, teams, ...props} = this.props;
    const defaultRule = eventView
      ? createRuleFromEventView(eventView)
      : wizardTemplate
      ? createRuleFromWizardTemplate(wizardTemplate)
      : createDefaultRule();

    const userTeamIds = teams.filter(({isMember}) => isMember).map(({id}) => id);

    const projectTeamIds = new Set(project.teams.map(({id}) => id));
    const defaultOwnerId = userTeamIds.find(id => projectTeamIds.has(id)) ?? null;
    defaultRule.owner = defaultOwnerId && `team:${defaultOwnerId}`;

    return (
      <RuleForm
        onSubmitSuccess={this.handleSubmitSuccess}
        rule={{...defaultRule, projects: [project.slug]}}
        sessionId={sessionId}
        project={project}
        userTeamIds={userTeamIds}
        {...props}
      />
    );
  }
}

export default withTeams(IncidentRulesCreate);
