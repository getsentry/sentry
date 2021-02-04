import React from 'react';
import omit from 'lodash/omit';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {
  DynamicSamplingConditionLogicalInner,
  DynamicSamplingConditionMultiple,
  DynamicSamplingInnerName,
  DynamicSamplingInnerOperator,
  DynamicSamplingRule,
  DynamicSamplingRules,
} from 'app/types/dynamicSampling';
import {defined} from 'app/utils';
import NumberField from 'app/views/settings/components/forms/numberField';
import RadioField from 'app/views/settings/components/forms/radioField';

import ConditionFields from './conditionFields';
import handleXhrErrorResponse from './handleXhrErrorResponse';
import {Transaction} from './utils';

const transactionChoices = [
  [Transaction.ALL, t('All')],
  [Transaction.MATCH_CONDITIONS, t('Match Conditions')],
] as Array<[string, string]>;

type Conditions = React.ComponentProps<typeof ConditionFields>['conditions'];

type Props = ModalRenderProps & {
  api: Client;
  organization: Organization;
  project: Project;
  errorRules: DynamicSamplingRules;
  transactionRules: DynamicSamplingRules;
  onSubmitSuccess: (project: Project) => void;
  rule?: DynamicSamplingRule;
};

type State = {
  transaction: Transaction;
  conditions: Conditions;
  sampleRate?: number;
  errors: {
    sampleRate?: string;
  };
};

class Form<P extends Props = Props, S extends State = State> extends React.Component<
  P,
  S
> {
  state = this.getDefaultState() as Readonly<S>;

  componentDidUpdate(_prevProps: P, prevState: S) {
    if (
      prevState.transaction === Transaction.ALL &&
      this.state.transaction !== Transaction.ALL &&
      !this.state.conditions.length
    ) {
      this.handleAddCondition();
    }
  }

  getDefaultState(): State {
    const {rule} = this.props;

    if (rule) {
      const {condition: conditions, sampleRate} = rule as DynamicSamplingRule;

      const {inner} = conditions as DynamicSamplingConditionMultiple;

      return {
        transaction: !inner.length ? Transaction.ALL : Transaction.MATCH_CONDITIONS,
        conditions: inner.map(({name, value}) => ({
          category: name,
          match: value.join(' '),
        })),
        sampleRate: sampleRate * 100,
        errors: {},
      };
    }

    return {
      transaction: Transaction.ALL,
      conditions: [],
      errors: {},
    };
  }

  getNewCondition(condition: Conditions[0]): DynamicSamplingConditionLogicalInner {
    const commonValues = {
      name: condition.category,
      value: condition.match.split(' ').filter(match => !!match),
    };

    if (
      condition.category === DynamicSamplingInnerName.EVENT_RELEASE ||
      condition.category === DynamicSamplingInnerName.TRACE_RELEASE
    ) {
      return {
        ...commonValues,
        op: DynamicSamplingInnerOperator.GLOB_MATCH,
      };
    }

    return {
      ...commonValues,
      op: DynamicSamplingInnerOperator.EQUAL,
      ignoreCase: true,
    };
  }

  getSuccessMessage() {
    const {rule} = this.props;
    return rule
      ? t('Successfully edited dynamic sampling rule')
      : t('Successfully added dynamic sampling rule');
  }

  clearError<F extends keyof State['errors']>(field: F) {
    this.setState(state => ({
      errors: omit(state.errors, field),
    }));
  }

  convertErrorXhrResponse(error: ReturnType<typeof handleXhrErrorResponse>) {
    switch (error.type) {
      case 'sampleRate':
        this.setState(prevState => ({
          errors: {...prevState.errors, sampleRate: error.message},
        }));
        break;
      default:
        addErrorMessage(error.message);
    }
  }

  async submitRules(newRules: DynamicSamplingRules, currentRuleIndex: number) {
    const {organization, project, api, onSubmitSuccess, closeModal} = this.props;

    try {
      const newProjectDetails = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {method: 'PUT', data: {dynamicSampling: {rules: newRules}}}
      );
      onSubmitSuccess(newProjectDetails);
      addSuccessMessage(this.getSuccessMessage());
      closeModal();
    } catch (error) {
      this.convertErrorXhrResponse(handleXhrErrorResponse(error, currentRuleIndex));
    }
  }

  handleChange = <T extends keyof S>(field: T, value: S[T]) => {
    this.setState(prevState => ({...prevState, [field]: value}));
  };

  handleSubmit = (): never | void => {
    // Children have to implement this
    throw new Error('Not implemented');
  };

  handleAddCondition = (): never | void => {
    // Children have to implement this
    throw new Error('Not implemented');
  };

  handleChangeCondition = <T extends keyof Conditions[0]>(
    index: number,
    field: T,
    value: Conditions[0][T]
  ) => {
    const newConditions = [...this.state.conditions];
    newConditions[index][field] = value;
    this.setState({conditions: newConditions});
  };

  handleDeleteCondition = (index: number) => () => {
    const newConditions = [...this.state.conditions];
    newConditions.splice(index, 1);

    if (!newConditions.length) {
      this.setState({
        conditions: newConditions,
        transaction: Transaction.ALL,
      });
      return;
    }
    this.setState({conditions: newConditions});
  };

  getModalTitle() {
    return '';
  }

  geTransactionFieldDescription() {
    return {
      label: '',
      help: '',
    };
  }

  getExtraFields(): React.ReactElement | null {
    return null;
  }

  getCategoryOptions(): Array<[DynamicSamplingInnerName, string]> {
    // Children have to implement this
    throw new Error('Not implemented');
  }

  render() {
    const {Header, Body, closeModal, Footer} = this.props as Props;
    const {sampleRate, conditions, transaction, errors} = this.state;

    const transactionField = this.geTransactionFieldDescription();
    const categoryOptions = this.getCategoryOptions();

    const submitDisabled =
      !defined(sampleRate) ||
      (!!conditions.length &&
        !!conditions.find(condition => {
          if (condition.category !== DynamicSamplingInnerName.LEGACY_BROWSERS) {
            return !condition.match;
          }
          return false;
        }));

    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {this.getModalTitle()}
        </Header>
        <Body>
          {this.getExtraFields()}
          <RadioField
            {...transactionField}
            name="transaction"
            choices={transactionChoices}
            onChange={value => this.handleChange('transaction', value)}
            value={transaction}
            inline={false}
            hideControlState
            showHelpInTooltip
            stacked
          />
          {transaction !== Transaction.ALL && (
            <ConditionFields
              conditions={conditions}
              categoryOptions={categoryOptions}
              onAdd={this.handleAddCondition}
              onChange={this.handleChangeCondition}
              onDelete={this.handleDeleteCondition}
            />
          )}
          <NumberField
            label={t('Sampling Rate')}
            help={t('this is a description')}
            name="sampleRate"
            onChange={value => {
              this.handleChange('sampleRate', value ? Number(value) : undefined);
              if (!!errors.sampleRate) {
                this.clearError('sampleRate');
              }
            }}
            value={sampleRate}
            inline={false}
            hideControlState={!errors.sampleRate}
            error={errors.sampleRate}
            showHelpInTooltip
            stacked
          />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button
              priority="primary"
              onClick={this.handleSubmit}
              disabled={submitDisabled}
            >
              {t('Save')}
            </Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

export default Form;
