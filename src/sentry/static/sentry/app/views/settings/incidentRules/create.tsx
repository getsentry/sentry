import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import recreateRoute from 'app/utils/recreateRoute';

import RuleForm from './ruleForm';

type RouteParams = {
  orgId: string;
  projectId: string;
};
type Props = {};

class IncidentRulesCreate extends React.Component<
  RouteComponentProps<RouteParams, {}> & Props
> {
  handleSubmitSuccess = data => {
    const {params, routes, location} = this.props;

    this.props.router.push(
      recreateRoute(`${data.id}/`, {params, routes, location, stepBack: -1})
    );
  };

  render() {
    const {orgId, projectId} = this.props.params;

    return (
      <RuleForm
        orgId={orgId}
        projectId={projectId}
        onSubmitSuccess={this.handleSubmitSuccess}
      />
    );
  }
}
export default IncidentRulesCreate;
