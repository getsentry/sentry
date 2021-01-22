import React from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {
  DynamicSamplingConditionOperator,
  DynamicSamplingRule,
} from 'app/types/dynamicSampling';
import {defined} from 'app/utils';
import Field from 'app/views/settings/components/forms/field';
import NumberField from 'app/views/settings/components/forms/numberField';
import RadioField from 'app/views/settings/components/forms/radioField';

import Condition from './condition';

enum Transaction {
  ALL = 'all',
  MATCH_CONDITIONS = 'match-conditions',
}

const transactionsChoices = [
  [Transaction.ALL, t('All')],
  [Transaction.MATCH_CONDITIONS, t('Match Conditions')],
] as Array<[string, string]>;

type Conditions = React.ComponentProps<typeof Condition>['conditions'];

type Props = ModalRenderProps & {
  organization: Organization;
  onSubmit: (rule: DynamicSamplingRule) => void;
  platformDocLink?: string;
};

type State = {
  tracing: boolean;
  transactions: Transaction;
  conditions: Conditions;
  sampleRate?: number;
};

class TransactionRuleModal extends React.Component<Props, State> {
  state: State = {
    tracing: true,
    transactions: Transaction.ALL,
    conditions: [],
  };

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (
      prevState.transactions === Transaction.ALL &&
      this.state.transactions !== Transaction.ALL &&
      !this.state.conditions.length
    ) {
      this.handleAddCondition();
    }
  }

  handleAddCondition = () => {
    this.setState(prevState => ({
      conditions: [
        ...prevState.conditions,
        {
          category: DynamicSamplingConditionOperator.GLOB_MATCH,
          match: '',
        },
      ],
    }));
  };

  handleDeleteCondition = (index: number) => () => {
    const newConditions = [...this.state.conditions];
    newConditions.splice(index, 1);

    if (!newConditions.length) {
      this.setState({
        conditions: newConditions,
        transactions: Transaction.ALL,
      });
      return;
    }
    this.setState({conditions: newConditions});
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

  handleChange = <T extends keyof State>(field: T, value: State[T]) => {
    this.setState(prevState => ({...prevState, [field]: value}));
  };

  handleSubmit = async () => {
    const {sampleRate} = this.state;

    if (!defined(sampleRate)) {
      return;
    }

    // TODO(PRISCILA): Finalize this logic according to the new structure
  };

  handleSubmitSuccess = () => {};

  render() {
    const {Header, Body, closeModal, platformDocLink, Footer} = this.props;
    const {tracing, transactions, sampleRate, conditions} = this.state;

    const submitDisabled =
      !defined(sampleRate) ||
      (!!conditions.length && !!conditions.find(condition => !condition.match));

    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Add a custom rule for transactions')}
        </Header>
        <Body>
          <Field
            label={t('Tracing')}
            help={t('this is a description')}
            inline={false}
            flexibleControlStateSize
            stacked
            showHelpInTooltip
          >
            <TracingWrapper>
              <StyledCheckboxFancy
                onClick={() => this.handleChange('tracing', !tracing)}
                isChecked={tracing}
              />
              {platformDocLink
                ? tct(
                    'Include all related transactions by trace ID. This can span across multiple projects. All related errors will remain. [link:Learn more about tracing].',
                    {link: <ExternalLink href={platformDocLink} />}
                  )
                : t(
                    'Include all related transactions by trace ID. This can span across multiple projects. All related errors will remain.'
                  )}
            </TracingWrapper>
          </Field>
          <RadioField
            label={t('Transactions')}
            name="transactions"
            choices={transactionsChoices}
            help={t('this is a description')}
            onChange={value => this.handleChange('transactions', value)}
            inline={false}
            value={transactions}
            hideControlState
            showHelpInTooltip
            stacked
          />
          {transactions !== Transaction.ALL && (
            <Condition
              conditions={conditions}
              onAdd={this.handleAddCondition}
              onChange={this.handleChangeCondition}
              onDelete={this.handleDeleteCondition}
            />
          )}
          <NumberField
            label={t('Sampling Rate')}
            help={t('this is a description')}
            name="sampleRate"
            onChange={value =>
              this.handleChange('sampleRate', value ? Number(value) : undefined)
            }
            inline={false}
            hideControlState
            stacked
            showHelpInTooltip
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

export default TransactionRuleModal;

const TracingWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
`;

const StyledCheckboxFancy = styled(CheckboxFancy)`
  margin-top: ${space(0.5)};
`;
