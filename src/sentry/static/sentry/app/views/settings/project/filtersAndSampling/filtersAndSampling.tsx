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

const dynamicSampling = {
  rules: [
    // {
    //   condition: {
    //     op: 'not',
    //     inner: {op: 'glob', name: 'event.release', value: ['a', 'b']},
    //   },
    //   sampleRate: 0.8,
    //   type: 'error',
    // },
    {
      condition: {
        op: 'and',
        inner: [
          {op: 'glob', name: 'event.release', value: ['a', 'b']},
          {op: 'eq', name: 'event.environment', value: ['x']},
        ],
      },
      sampleRate: 0.1,
      type: 'error',
    },
    {
      condition: {
        op: 'and',
        inner: [{op: 'glob', name: 'trace.release', value: ['trace1', 'trace2']}],
      },
      sampleRate: 0.1,
      type: 'trace',
    },
    {
      condition: {
        op: 'and',
        inner: [
          {op: 'glob', name: 'event.release', value: ['tranc1', 'tranc2', 'tranc3']},
        ],
      },
      sampleRate: 0.5,
      type: 'transaction',
    },
  ],
} as {rules: DynamicSamplingRules};

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

    if (
      !isEqual(
        [...this.state.errorRules, ...this.state.transactionRules],
        dynamicSampling.rules
      )
    ) {
      this.submitRules();
    }
  }

  getRules() {
    const [errorRules, transactionRules] = partition(
      dynamicSampling.rules,
      rule => rule.type === DynamicSamplingRuleType.ERROR
    );

    this.setState({errorRules, transactionRules});
  }

  getRequestResponseMessage(rules: DynamicSamplingRules) {
    const {projectDetails} = this.state;

    if (!projectDetails) {
      return {
        succesMessage: t('Successfully saved dynamic sampling rule'),
        errorMessage: t('An unknown error occurred while saving dynamic sampling rule'),
      };
    }

    // const {dynamicSampling} = this.state

    if (rules.length !== dynamicSampling.rules.length) {
      if (rules.length > dynamicSampling.rules.length) {
        return {
          succesMessage: t('Successfully added dynamic sampling rule'),
          errorMessage: t('An unknown error occurred while adding dynamic sampling rule'),
        };
      }
      return {
        succesMessage: t('Successfully deleted dynamic sampling rule'),
        errorMessage: t('An unknown error occurred while deleting dynamic sampling rule'),
      };
    }

    return {
      succesMessage: t('Successfully edited dynamic sampling rule'),
      errorMessage: t('An unknown error occurred while editing dynamic sampling rule'),
    };
  }

  async submitRules() {
    const {organization, project} = this.props;
    const {errorRules, transactionRules} = this.state;

    const rules = [...errorRules, ...transactionRules];
    const {succesMessage, errorMessage} = this.getRequestResponseMessage(rules);

    try {
      const projectDetails = await this.api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {method: 'PUT', data: {dynamicSampling: {rules}}}
      );
      this.setState({projectDetails});
      addSuccessMessage(succesMessage);
    } catch (error) {
      addErrorMessage(errorMessage);
    }
  }

  handleOpenErrorRule = (rule?: DynamicSamplingRule) => () => {
    const {organization} = this.props;
    return openModal(
      modalProps => (
        <ErrorRuleModal
          {...modalProps}
          organization={organization}
          onSubmit={this.handleSaveRule(rule)}
          rule={rule}
        />
      ),
      {
        modalCss,
      }
    );
  };

  handleOpenTransactionRule = (rule?: DynamicSamplingRule) => () => {
    const {organization} = this.props;
    return openModal(
      modalProps => (
        <TransactionRuleModal
          {...modalProps}
          organization={organization}
          onSubmit={this.handleSaveRule(rule)}
          rule={rule}
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

  handleSaveRule = (rule?: DynamicSamplingRule) => async (
    newRule: DynamicSamplingRule
  ) => {
    if (rule) {
      if (rule.type === DynamicSamplingRuleType.ERROR) {
        this.setState(state => ({
          errorRules: state.errorRules.map(errorRule => {
            if (rule === errorRule) {
              return newRule;
            }
            return errorRule;
          }),
        }));
      }

      this.setState(state => ({
        transactionRules: state.transactionRules.map(transactionRule => {
          if (rule === transactionRule) {
            return newRule;
          }
          return transactionRule;
        }),
      }));

      return;
    }

    this.setState(state => ({
      transactionRules: [...state.transactionRules, newRule],
    }));
  };

  handleDeleteRule = (rule: DynamicSamplingRule) => async () => {
    if (rule.type === DynamicSamplingRuleType.ERROR) {
      this.setState(state => ({
        errorRules: state.errorRules.filter(errorRule => errorRule !== rule),
      }));
      return;
    }

    this.setState(state => ({
      transactionRules: state.transactionRules.filter(
        transactionRule => transactionRule !== rule
      ),
    }));
  };

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
          onAddRule={this.handleAddRule('errorRules')}
          onEditRule={this.handleEditRule}
          onDeleteRule={this.handleDeleteRule}
          disabled={disabled}
        />
        <TextBlock>
          {t(
            'The transaction order is limited. Traces must occur first and individual transactions must occur last. Any individual transaction rules before a trace rule will be disregarded. '
          )}
        </TextBlock>
        <RulesPanel
          rules={transactionRules}
          onAddRule={this.handleAddRule('transactionRules')}
          onEditRule={this.handleEditRule}
          onDeleteRule={this.handleDeleteRule}
          disabled={disabled}
        />
      </React.Fragment>
    );
  }
}

export default withProject(FiltersAndSampling);
