import React from 'react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';
import {defined} from 'app/utils';
import NumberField from 'app/views/settings/components/forms/numberField';
import RadioField from 'app/views/settings/components/forms/radioField';

import ConditionFields from './conditionFields';
import {Category} from './utils';

enum Transaction {
  ALL = 'all',
  MATCH_CONDITIONS = 'match-conditions',
}

const transactionChoices = [
  [Transaction.ALL, t('All')],
  [Transaction.MATCH_CONDITIONS, t('Match Conditions')],
] as Array<[string, string]>;

type Conditions = React.ComponentProps<typeof ConditionFields>['conditions'];

type Props = ModalRenderProps & {
  organization: Organization;
  onSubmit: (rule: DynamicSamplingRule) => void;
  platformDocLink?: string;
};

type State = {
  transaction: Transaction;
  conditions: Conditions;
  sampleRate?: number;
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
    return {
      transaction: Transaction.ALL,
      conditions: [],
    };
  }

  handleAddCondition = () => {
    this.setState(prevState => ({
      conditions: [
        ...prevState.conditions,
        {
          category: Category.RELEASES,
          match: '',
        },
      ],
    }));
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

  handleChange = <T extends keyof S>(field: T, value: S[T]) => {
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

  getCategoryOptions(): Array<[string, string]> {
    return [['', '']];
  }

  render() {
    const {Header, Body, closeModal, Footer} = this.props as Props;
    const {sampleRate, conditions, transaction} = this.state;

    const transactionField = this.geTransactionFieldDescription();
    const categoryOptions = this.getCategoryOptions();

    const submitDisabled =
      !defined(sampleRate) ||
      (!!conditions.length &&
        !!conditions.find(condition => {
          if (condition.category !== Category.LEGACY_BROWSERS) {
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
            onChange={value =>
              this.handleChange('sampleRate', value ? Number(value) : undefined)
            }
            inline={false}
            hideControlState
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
