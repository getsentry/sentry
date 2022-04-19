import {RouteComponentProps} from 'react-router';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {metric} from 'sentry/utils/analytics';
import RuleForm from 'sentry/views/alerts/incidentRules/ruleForm';
import {IncidentRule} from 'sentry/views/alerts/incidentRules/types';
import AsyncView from 'sentry/views/asyncView';

type RouteParams = {
  orgId: string;
  projectId: string;
  ruleId: string;
};

type Props = {
  onChangeTitle: (data: string) => void;
  organization: Organization;
  project: Project;
  userTeamIds: string[];
} & RouteComponentProps<RouteParams, {}>;

type State = {
  actions: Map<string, any>;
  rule: IncidentRule; // This is temp
} & AsyncView['state'];

class IncidentRulesDetails extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      actions: new Map(),
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId, ruleId} = this.props.params;

    return [['rule', `/organizations/${orgId}/alert-rules/${ruleId}/`]];
  }

  onRequestSuccess({stateKey, data}) {
    if (stateKey === 'rule' && data.name) {
      this.props.onChangeTitle(data.name);
    }
  }

  onLoadAllEndpointsSuccess() {
    const {rule} = this.state;
    if (rule?.errors) {
      (rule?.errors || []).map(({detail}) => addErrorMessage(detail, {append: true}));
    }
  }

  handleSubmitSuccess = () => {
    const {router, project} = this.props;
    const {orgId} = this.props.params;

    metric.endTransaction({name: 'saveAlertRule'});
    router.push({
      pathname: `/organizations/${orgId}/alerts/rules/`,
      query: {project: project.id},
    });
  };

  renderError(error?: Error, disableLog = false): React.ReactNode {
    const {errors} = this.state;
    const notFound = Object.values(errors).find(resp => resp && resp.status === 404);
    if (notFound) {
      return (
        <Alert type="error" showIcon>
          {t('This alert rule could not be found.')}
        </Alert>
      );
    }
    return super.renderError(error, disableLog);
  }

  renderBody() {
    const {ruleId} = this.props.params;
    const {rule} = this.state;

    return (
      <RuleForm
        {...this.props}
        ruleId={ruleId}
        rule={rule}
        onSubmitSuccess={this.handleSubmitSuccess}
      />
    );
  }
}

export default IncidentRulesDetails;
