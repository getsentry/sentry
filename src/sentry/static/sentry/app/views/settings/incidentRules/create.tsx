import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Organization, Project} from 'app/types';
import {
  createDefaultRule,
  createRuleFromEventView,
} from 'app/views/settings/incidentRules/constants';
import recreateRoute from 'app/utils/recreateRoute';
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
} & RouteComponentProps<RouteParams, {}>;

/**
 * Show metric rules form with an empty rule. Redirects to alerts list after creation.
 */
class IncidentRulesCreate extends React.Component<Props> {
  handleSubmitSuccess = () => {
    const {params, routes, router, location} = this.props;

    router.push(recreateRoute('', {params, routes, location, stepBack: -1}));
  };

  render() {
    const {project, eventView, ...props} = this.props;
    const defaultRule = eventView
      ? createRuleFromEventView(eventView)
      : createDefaultRule();

    return (
      <RuleForm
        onSubmitSuccess={this.handleSubmitSuccess}
        rule={{...defaultRule, projects: [project.slug]}}
        {...props}
      />
    );
  }
}

export default IncidentRulesCreate;
