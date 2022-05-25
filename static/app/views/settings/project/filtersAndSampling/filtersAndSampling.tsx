import {Fragment} from 'react';
import partition from 'lodash/partition';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {
  DynamicSamplingConditionOperator,
  DynamicSamplingRule,
  DynamicSamplingRules,
  DynamicSamplingRuleType,
} from 'sentry/types/dynamicSampling';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import withProject from 'sentry/utils/withProject';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import {modalCss} from './modal/utils';
import Modal from './modal';
import RulesPanel from './rulesPanel';
import {DYNAMIC_SAMPLING_DOC_LINK} from './utils';

type Props = AsyncView['props'] & {
  hasAccess: boolean;
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  errorRules: DynamicSamplingRules;
  projectDetails: Project | null;
  transactionRules: DynamicSamplingRules;
};

class FiltersAndSampling extends AsyncView<Props, State> {
  getTitle() {
    return t('Filters & Sampling');
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      errorRules: [],
      transactionRules: [],
      projectDetails: null,
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, project} = this.props;
    return [['projectDetails', `/projects/${organization.slug}/${project.slug}/`]];
  }

  componentDidMount() {
    const {organization, project} = this.props;

    trackAdvancedAnalyticsEvent('sampling.settings.view', {
      organization,
      project_id: project.id,
    });
    this.getRules();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.projectDetails !== this.state.projectDetails) {
      this.getRules();
      return;
    }
  }

  getRules() {
    const {projectDetails} = this.state;

    if (!projectDetails) {
      return;
    }

    const {dynamicSampling} = projectDetails;
    const rules = dynamicSampling?.rules ?? [];

    const [errorRules, transactionRules] = partition(
      rules,
      rule => rule.type === DynamicSamplingRuleType.ERROR
    );

    this.setState({errorRules, transactionRules});
  }

  successfullySubmitted = (projectDetails: Project, successMessage?: React.ReactNode) => {
    this.setState({projectDetails});

    if (successMessage) {
      addSuccessMessage(successMessage);
    }
  };

  handleOpenRule = (type: 'error' | 'transaction', rule?: DynamicSamplingRule) => () => {
    const {organization, project, hasAccess} = this.props;
    const {errorRules, transactionRules} = this.state;
    return openModal(
      modalProps => (
        <Modal
          {...modalProps}
          type={type}
          api={this.api}
          organization={organization}
          project={project}
          rule={rule}
          errorRules={errorRules}
          transactionRules={transactionRules}
          onSubmitSuccess={this.successfullySubmitted}
          disabled={!hasAccess}
        />
      ),
      {
        modalCss,
      }
    );
  };

  handleAddRule =
    <T extends keyof Pick<State, 'errorRules' | 'transactionRules'>>(type: T) =>
    () => {
      if (type === 'errorRules') {
        this.handleOpenRule('error')();
        return;
      }

      this.handleOpenRule('transaction')();
    };

  handleEditRule = (rule: DynamicSamplingRule) => () => {
    if (rule.type === DynamicSamplingRuleType.ERROR) {
      this.handleOpenRule('error', rule)();
      return;
    }

    this.handleOpenRule('transaction', rule)();
  };

  handleDeleteRule = (rule: DynamicSamplingRule) => () => {
    const {organization, project} = this.props;
    const {errorRules, transactionRules} = this.state;

    const conditions = rule.condition.inner.map(({name}) => name);

    trackAdvancedAnalyticsEvent('sampling.settings.rule.delete', {
      organization,
      project_id: project.id,
      sampling_rate: rule.sampleRate * 100,
      conditions,
      conditions_stringified: conditions.sort().join(', '),
    });

    const newErrorRules =
      rule.type === DynamicSamplingRuleType.ERROR
        ? errorRules.filter(errorRule => errorRule.id !== rule.id)
        : errorRules;

    const newTransactionRules =
      rule.type !== DynamicSamplingRuleType.ERROR
        ? transactionRules.filter(transactionRule => transactionRule.id !== rule.id)
        : transactionRules;

    const newRules = [...newErrorRules, ...newTransactionRules];

    this.submitRules(
      newRules,
      t('Successfully deleted dynamic sampling rule'),
      t('An error occurred while deleting dynamic sampling rule')
    );
  };

  handleUpdateRules = (rules: Array<DynamicSamplingRule>) => {
    if (!rules.length) {
      return;
    }

    const {errorRules, transactionRules} = this.state;

    if (rules[0]?.type === DynamicSamplingRuleType.ERROR) {
      this.submitRules([...rules, ...transactionRules]);
      return;
    }
    this.submitRules([...errorRules, ...rules]);
  };

  async submitRules(
    newRules: DynamicSamplingRules,
    successMessage?: string,
    errorMessage?: string
  ) {
    const {organization, project} = this.props;

    try {
      const projectDetails = await this.api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {method: 'PUT', data: {dynamicSampling: {rules: newRules}}}
      );
      this.successfullySubmitted(projectDetails, successMessage);
    } catch (error) {
      this.getRules();
      if (errorMessage) {
        addErrorMessage(errorMessage);
      }
    }
  }

  renderBody() {
    const {errorRules, transactionRules} = this.state;
    const {hasAccess, organization} = this.props;
    const disabled = !hasAccess;

    const hasNotSupportedConditionOperator = [...errorRules, ...transactionRules].some(
      rule => rule.condition.op !== DynamicSamplingConditionOperator.AND
    );

    if (hasNotSupportedConditionOperator) {
      return (
        <Alert type="error">
          {t('A condition operator has been found that is not yet supported.')}
        </Alert>
      );
    }

    return (
      <Fragment>
        <SettingsPageHeader title={this.getTitle()} />
        <PermissionAlert />
        <TextBlock>
          {tct(
            'Manage the inbound data you want to store. To change the sampling rate or rate limits, [link:update your SDK configuration]. The rules added below will apply on top of your SDK configuration. Any new rule may take a few minutes to propagate.',
            {
              link: <ExternalLink href={DYNAMIC_SAMPLING_DOC_LINK} />,
            }
          )}
        </TextBlock>
        {organization.features.includes('filters-and-sampling-error-rules') && (
          <RulesPanel
            rules={errorRules}
            disabled={disabled}
            onAddRule={this.handleAddRule('errorRules')}
            onEditRule={this.handleEditRule}
            onDeleteRule={this.handleDeleteRule}
            onUpdateRules={this.handleUpdateRules}
            isErrorPanel
          />
        )}
        <TextBlock>
          {t('Rules for traces should precede rules for individual transactions.')}
        </TextBlock>
        <RulesPanel
          rules={transactionRules}
          disabled={disabled}
          onAddRule={this.handleAddRule('transactionRules')}
          onEditRule={this.handleEditRule}
          onDeleteRule={this.handleDeleteRule}
          onUpdateRules={this.handleUpdateRules}
        />
      </Fragment>
    );
  }
}

export default withProject(FiltersAndSampling);
