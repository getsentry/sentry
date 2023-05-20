import {RouteComponentProps} from 'react-router';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {metric} from 'sentry/utils/analytics';
import routeTitleGen from 'sentry/utils/routeTitle';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import RuleForm from 'sentry/views/alerts/rules/metric/ruleForm';
import {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import AsyncView from 'sentry/views/asyncView';

type RouteParams = {
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
  rule: MetricRule; // This is temp
} & AsyncView['state'];

class MetricRulesEdit extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      actions: new Map(),
    };
  }

  getTitle(): string {
    const {organization, project} = this.props;
    const {rule} = this.state;
    const ruleName = rule?.name;

    return routeTitleGen(
      ruleName ? t('Alert - %s', ruleName) : '',
      organization.slug,
      false,
      project?.slug
    );
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization} = this.props;
    const {ruleId} = this.props.params;

    return [['rule', `/organizations/${organization.slug}/alert-rules/${ruleId}/`]];
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
    const {organization, router} = this.props;
    const {ruleId} = this.props.params;

    metric.endTransaction({name: 'saveAlertRule'});
    router.push(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/alerts/rules/details/${ruleId}/`,
      })
    );
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
        disableProjectSelector
      />
    );
  }
}

export default MetricRulesEdit;
