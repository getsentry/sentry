import React from 'react';
import isEqual from 'lodash/isEqual';
import partition from 'lodash/partition';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {openModal} from 'app/actionCreators/modal';
import Alert from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import {Organization, Project} from 'app/types';
import {
  DynamicSamplingConditionOperator,
  DynamicSamplingRule,
  DynamicSamplingRules,
  DynamicSamplingRuleType,
} from 'app/types/dynamicSampling';
import withProject from 'app/utils/withProject';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';

import ErrorRuleModal from './modals/errorRuleModal';
import TransactionRuleModal from './modals/transactionRuleModal';
import {modalCss} from './modals/utils';
import RulesPanel from './rulesPanel';
import {DYNAMIC_SAMPLING_DOC_LINK} from './utils';

type Props = AsyncView['props'] & {
  project: Project;
  organization: Organization;
  hasAccess: boolean;
};

type State = AsyncView['state'] & {
  errorRules: DynamicSamplingRules;
  transactionRules: DynamicSamplingRules;
  projectDetails: Project | null;
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

  successfullySubmitted = (projectDetails: Project) => {
    this.setState({projectDetails});
  };

  handleOpenErrorRule = (rule?: DynamicSamplingRule) => () => {
    const {organization, project} = this.props;
    const {errorRules, transactionRules} = this.state;
    return openModal(
      modalProps => (
        <ErrorRuleModal
          {...modalProps}
          api={this.api}
          organization={organization}
          project={project}
          rule={rule}
          errorRules={errorRules}
          transactionRules={transactionRules}
          onSubmitSuccess={this.successfullySubmitted}
        />
      ),
      {
        modalCss,
      }
    );
  };

  handleOpenTransactionRule = (rule?: DynamicSamplingRule) => () => {
    const {organization, project} = this.props;
    const {errorRules, transactionRules} = this.state;
    return openModal(
      modalProps => (
        <TransactionRuleModal
          {...modalProps}
          api={this.api}
          organization={organization}
          project={project}
          rule={rule}
          errorRules={errorRules}
          transactionRules={transactionRules}
          onSubmitSuccess={this.successfullySubmitted}
        />
      ),
      {
        modalCss,
      }
    );
  };

  handleAddRule = <T extends keyof Pick<State, 'errorRules' | 'transactionRules'>>(
    type: T
  ) => () => {
    if (type === 'errorRules') {
      this.handleOpenErrorRule()();
      return;
    }

    this.handleOpenTransactionRule()();
  };

  handleEditRule = (rule: DynamicSamplingRule) => () => {
    if (rule.type === DynamicSamplingRuleType.ERROR) {
      this.handleOpenErrorRule(rule)();
      return;
    }

    this.handleOpenTransactionRule(rule)();
  };

  handleDeleteRule = (rule: DynamicSamplingRule) => () => {
    const {errorRules, transactionRules} = this.state;

    const newErrorRules =
      rule.type === DynamicSamplingRuleType.ERROR
        ? errorRules.filter(errorRule => !isEqual(errorRule, rule))
        : errorRules;

    const newTransactionRules =
      rule.type !== DynamicSamplingRuleType.ERROR
        ? transactionRules.filter(transactionRule => !isEqual(transactionRule, rule))
        : transactionRules;

    const newRules = [...newErrorRules, ...newTransactionRules];

    this.submitRules(
      newRules,
      t('Successfully deleted dynamic sampling rule'),
      t('An error occurred while deleting dynamic sampling rule')
    );
  };

  handleUpdateRules = (rules: Array<DynamicSamplingRule>) => {
    const {errorRules, transactionRules} = this.state;
    if (rules[0].type === DynamicSamplingRuleType.ERROR) {
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
      this.setState({projectDetails});
      if (successMessage) {
        addSuccessMessage(successMessage);
      }
    } catch (error) {
      this.getRules();
      if (errorMessage) {
        addErrorMessage(errorMessage);
      }
    }
  }

  renderBody() {
    const {errorRules, transactionRules} = this.state;
    const {hasAccess} = this.props;
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
      <React.Fragment>
        <SettingsPageHeader title={this.getTitle()} />
        <PermissionAlert />
        <TextBlock>
          {tct(
            'Manage the inbound data you want to store. To change the sampling rate or rate limits, [link:update your SDK configuration]. The rules added below will apply on top of your SDK configuration.',
            {
              link: <ExternalLink href={DYNAMIC_SAMPLING_DOC_LINK} />,
            }
          )}
        </TextBlock>
        <RulesPanel
          rules={errorRules}
          disabled={disabled}
          onAddRule={this.handleAddRule('errorRules')}
          onEditRule={this.handleEditRule}
          onDeleteRule={this.handleDeleteRule}
          onUpdateRules={this.handleUpdateRules}
        />
        <TextBlock>
          {t(
            'The transaction order is limited. Traces must occur first and individual transactions must occur last. Any individual transaction rules before a trace rule will be disregarded. '
          )}
        </TextBlock>
        <RulesPanel
          rules={transactionRules}
          disabled={disabled}
          onAddRule={this.handleAddRule('transactionRules')}
          onEditRule={this.handleEditRule}
          onDeleteRule={this.handleDeleteRule}
          onUpdateRules={this.handleUpdateRules}
        />
      </React.Fragment>
    );
  }
}

export default withProject(FiltersAndSampling);
