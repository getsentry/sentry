import React from 'react';
import {RouteComponentProps} from 'react-router';

import {Organization, Project, Team} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import withTeams from 'app/utils/withTeams';
import {WizardRuleTemplate} from 'app/views/alerts/wizard/options';
import {
  createDefaultRule,
  createRuleFromEventView,
  createRuleFromWizardTemplate,
} from 'app/views/settings/incidentRules/constants';

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
  wizardTemplate?: WizardRuleTemplate;
  sessionId?: string;
  teams: Team[];
} & RouteComponentProps<RouteParams, {}>;

/**
 * Show metric rules form with an empty rule. Redirects to alerts list after creation.
 */
class IncidentRulesCreate extends React.Component<Props> {
  handleSubmitSuccess = () => {
    const {router} = this.props;
    const {orgId} = this.props.params;

    router.push(`/organizations/${orgId}/alerts/rules/`);
  };

  render() {
    const {project, eventView, wizardTemplate, sessionId, teams, ...props} = this.props;
    const defaultRule = eventView
      ? createRuleFromEventView(eventView)
      : wizardTemplate
      ? createRuleFromWizardTemplate(wizardTemplate)
      : createDefaultRule();

    const userTeamIdArr = teams.filter(({isMember}) => isMember).map(({id}) => id);
    const userTeamIds = new Set(userTeamIdArr);

    if (props.organization.features.includes('team-alerts-ownership')) {
      const projectTeamIds = new Set(project.teams.map(({id}) => id));
      const defaultOwnerId = userTeamIdArr.find(id => projectTeamIds.has(id)) ?? null;
      defaultRule.owner = defaultOwnerId && `team:${defaultOwnerId}`;
    }

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
