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
import {getNewCondition} from './utils';

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
      conditionCategories={[
        [DynamicSamplingInnerName.EVENT_RELEASE, t('Release')],
        [DynamicSamplingInnerName.EVENT_ENVIRONMENT, t('Environment')],
        [DynamicSamplingInnerName.EVENT_USER_ID, t('User Id')],
        [DynamicSamplingInnerName.EVENT_USER_SEGMENT, t('User Segment')],
        [DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS, t('Browser Extensions')],
        [DynamicSamplingInnerName.EVENT_LOCALHOST, t('Localhost')],
        [DynamicSamplingInnerName.EVENT_LEGACY_BROWSER, t('Legacy Browser')],
        [DynamicSamplingInnerName.EVENT_WEB_CRAWLERS, t('Web Crawlers')],
        [DynamicSamplingInnerName.EVENT_IP_ADDRESSES, t('IP Address')],
        [DynamicSamplingInnerName.EVENT_CSP, t('Content Security Policy')],
        [DynamicSamplingInnerName.EVENT_ERROR_MESSAGES, t('Error Message')],
        [DynamicSamplingInnerName.EVENT_TRANSACTION, t('Transaction')],
      ]}
      rule={rule}
      onSubmit={handleSubmit}
    />
  );
}

export default ErrorRuleModal;
