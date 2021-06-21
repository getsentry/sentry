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
      return t('Edit Error Sampling Rule');
    }

    return t('Add Error Sampling Rule');
  }

  geTransactionFieldDescription() {
    return {
      label: t('Errors'),
      help: t(
        'This determines if the rule applies to all errors or only errors that match custom conditions.'
      ),
    };
  }

  getCategoryOptions(): Array<[DynamicSamplingInnerName, string]> {
    return [
      [DynamicSamplingInnerName.EVENT_RELEASE, t('Releases')],
      [DynamicSamplingInnerName.EVENT_ENVIRONMENT, t('Environments')],
      [DynamicSamplingInnerName.EVENT_USER_ID, t('User Id')],
      [DynamicSamplingInnerName.EVENT_USER_SEGMENT, t('User Segment')],
      [DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS, t('Browser Extensions')],
      [DynamicSamplingInnerName.EVENT_LOCALHOST, t('Localhost')],
      [DynamicSamplingInnerName.EVENT_LEGACY_BROWSER, t('Legacy Browsers')],
      [DynamicSamplingInnerName.EVENT_WEB_CRAWLERS, t('Web Crawlers')],
      [DynamicSamplingInnerName.EVENT_IP_ADDRESSES, t('IP Addresses')],
      [DynamicSamplingInnerName.EVENT_CSP, t('Content Security Policy')],
      [DynamicSamplingInnerName.EVENT_ERROR_MESSAGES, t('Error Messages')],
    ];
  }

  handleSubmit = () => {
    const {sampleRate, conditions, transaction} = this.state;

    if (!sampleRate) {
      return;
    }

    const {rule, errorRules, transactionRules} = this.props;

    const newRule: DynamicSamplingRule = {
      // All new/updated rules must have id equal to 0
      id: 0,
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
