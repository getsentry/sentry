import {RouteComponentProps} from 'react-router/lib/Router';
import { Component } from 'react';

import {Organization, Project} from 'app/types';
import {
  createDefaultRule,
  createRuleFromEventView,
} from 'app/views/settings/incidentRules/constants';
import EventView from 'app/utils/discover/eventView';

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
  sessionId?: string;
} & RouteComponentProps<RouteParams, {}>;

/**
 * Show metric rules form with an empty rule. Redirects to alerts list after creation.
 */
class IncidentRulesCreate extends Component<Props> {
  handleSubmitSuccess = () => {
    const {router} = this.props;
    const {orgId} = this.props.params;

    router.push(`/organizations/${orgId}/alerts/rules/`);
  };

  render() {
    const {project, eventView, sessionId, ...props} = this.props;
    const defaultRule = eventView
      ? createRuleFromEventView(eventView)
      : createDefaultRule();

    return (
      <RuleForm
        onSubmitSuccess={this.handleSubmitSuccess}
        rule={{...defaultRule, projects: [project.slug]}}
        sessionId={sessionId}
        project={project}
        {...props}
      />
    );
  }
}

export default IncidentRulesCreate;
