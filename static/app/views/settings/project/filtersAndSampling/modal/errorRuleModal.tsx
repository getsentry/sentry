import isEqual from 'lodash/isEqual';

import {t} from 'sentry/locale';
import {
  DynamicSamplingConditionOperator,
  DynamicSamplingInnerName,
  DynamicSamplingRule,
  DynamicSamplingRules,
  DynamicSamplingRuleType,
} from 'sentry/types/dynamicSampling';
import {defined} from 'sentry/utils';

import RuleModal from './ruleModal';
import {generateConditionCategoriesOptions, getNewCondition} from './utils';

type RuleModalProps = React.ComponentProps<typeof RuleModal>;

type Props = Omit<
  RuleModalProps,
  | 'transactionField'
  | 'title'
  | 'conditionCategories'
  | 'onSubmit'
  | 'emptyMessage'
  | 'onChange'
> & {
  errorRules: DynamicSamplingRules;
  transactionRules: DynamicSamplingRules;
};

function ErrorRuleModal({rule, errorRules, transactionRules, ...props}: Props) {
  function handleSubmit({
    sampleRate,
    conditions,
    submitRules,
  }: Parameters<RuleModalProps['onSubmit']>[0]) {
    if (!defined(sampleRate)) {
      return;
    }

    const newRule: DynamicSamplingRule = {
      // All new/updated rules must have id equal to 0
      id: 0,
      type: DynamicSamplingRuleType.ERROR,
      condition: {
        op: DynamicSamplingConditionOperator.AND,
        inner: !conditions.length ? [] : conditions.map(getNewCondition),
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

    submitRules(newRules, currentRuleIndex);
  }

  return (
    <RuleModal
      {...props}
      title={rule ? t('Edit Error Sampling Rule') : t('Add Error Sampling Rule')}
      emptyMessage={t('Apply sampling rate to all errors')}
      conditionCategories={generateConditionCategoriesOptions([
        DynamicSamplingInnerName.EVENT_RELEASE,
        DynamicSamplingInnerName.EVENT_ENVIRONMENT,
        DynamicSamplingInnerName.EVENT_USER_ID,
        DynamicSamplingInnerName.EVENT_USER_SEGMENT,
        DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS,
        DynamicSamplingInnerName.EVENT_LOCALHOST,
        DynamicSamplingInnerName.EVENT_LEGACY_BROWSER,
        DynamicSamplingInnerName.EVENT_WEB_CRAWLERS,
        DynamicSamplingInnerName.EVENT_IP_ADDRESSES,
        DynamicSamplingInnerName.EVENT_CSP,
        DynamicSamplingInnerName.EVENT_ERROR_MESSAGES,
        DynamicSamplingInnerName.EVENT_TRANSACTION,
        DynamicSamplingInnerName.EVENT_OS_NAME,
        DynamicSamplingInnerName.EVENT_OS_VERSION,
        DynamicSamplingInnerName.EVENT_DEVICE_FAMILY,
        DynamicSamplingInnerName.EVENT_DEVICE_NAME,
        DynamicSamplingInnerName.EVENT_CUSTOM_TAG,
      ])}
      rule={rule}
      onSubmit={handleSubmit}
    />
  );
}

export default ErrorRuleModal;
