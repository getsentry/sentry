import isEqual from 'lodash/isEqual';

import {t} from 'app/locale';
import {
  DynamicSamplingConditionOperator,
  DynamicSamplingInnerName,
  DynamicSamplingRule,
  DynamicSamplingRuleType,
} from 'app/types/dynamicSampling';

import Form from './form';
import {Transaction} from './utils';

type Props = Form['props'];

type State = Form['state'];

class ErrorRuleModal extends Form<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
    };
  }

  getModalTitle() {
    const {rule} = this.props;

    if (rule) {
      return t('Edit a custom rule for errors');
    }

    return t('Add a custom rule for errors');
  }

  geTransactionFieldDescription() {
    return {
      label: t('Error'),
      help: t('This is a description'),
    };
  }

  getCategoryOptions(): Array<[DynamicSamplingInnerName, string]> {
    return [
      [DynamicSamplingInnerName.EVENT_RELEASE, t('Releases')],
      [DynamicSamplingInnerName.EVENT_ENVIRONMENT, t('Environments')],
      [DynamicSamplingInnerName.EVENT_USER, t('Users')],
    ];
  }

  handleAddCondition = () => {
    this.setState(state => ({
      conditions: [
        ...state.conditions,
        {
          category: DynamicSamplingInnerName.EVENT_RELEASE,
          match: '',
        },
      ],
    }));
  };

  handleSubmit = () => {
    const {sampleRate, conditions, transaction} = this.state;

    if (!sampleRate) {
      return;
    }

    const {rule, errorRules, transactionRules} = this.props;

    const newRule: DynamicSamplingRule = {
      type: DynamicSamplingRuleType.ERROR,
      condition: {
        op: DynamicSamplingConditionOperator.AND,
        inner:
          transaction === Transaction.ALL ? [] : conditions.map(this.getNewCondition),
      },
      sampleRate: sampleRate / 100,
    };

    const newRules = rule
      ? [
          ...errorRules.map(errorRule =>
            isEqual(errorRule, rule) ? newRule : errorRule
          ),
          ...transactionRules,
        ]
      : [...errorRules, newRule, ...transactionRules];

    const currentRuleIndex = newRules.findIndex(newR => newR === newRule);
    this.submitRules(newRules, currentRuleIndex);
  };
}

export default ErrorRuleModal;
