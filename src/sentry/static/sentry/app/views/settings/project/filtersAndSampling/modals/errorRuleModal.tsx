import {t} from 'app/locale';
import {
  DynamicSamplingConditionOperator,
  DynamicSamplingInnerName,
  DynamicSamplingRule,
  DynamicSamplingRuleType,
} from 'app/types/dynamicSampling';

import Form from './form';

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
      [DynamicSamplingInnerName.EVENT_USER_SEGMENT, t('Users')],
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

  handleSubmit = async () => {
    const {sampleRate, conditions} = this.state;

    if (!sampleRate) {
      return;
    }

    const newRule: DynamicSamplingRule = {
      type: DynamicSamplingRuleType.ERROR,
      condition: {
        op: DynamicSamplingConditionOperator.AND,
        inner: conditions.map(this.getNewCondition),
      },
      sampleRate,
    };

    const {onSubmit, closeModal} = this.props;
    onSubmit(newRule);
    closeModal();
  };
}

export default ErrorRuleModal;
