import {useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import partition from 'lodash/partition';

import CheckboxFancy from 'sentry/components/checkboxFancy/checkboxFancy';
import Field from 'sentry/components/forms/field';
import ExternalLink from 'sentry/components/links/externalLink';
import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  DynamicSamplingConditionOperator,
  DynamicSamplingInnerName,
  DynamicSamplingRule,
  DynamicSamplingRules,
  DynamicSamplingRuleType,
} from 'sentry/types/dynamicSampling';
import {defined} from 'sentry/utils';

import {DYNAMIC_SAMPLING_DOC_LINK} from '../utils';

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
  | 'onChage'
> & {
  rules: DynamicSamplingRules;
};

function TransactionRuleModal({rule: ruleToUpdate, rules, ...props}: Props) {
  const theme = useTheme();

  const [tracing, setTracing] = useState(
    ruleToUpdate ? ruleToUpdate.type === DynamicSamplingRuleType.TRACE : true
  );

  const [isTracingDisabled, setIsTracingDisabled] = useState(
    !!ruleToUpdate?.condition.inner.length
  );

  function handleChange({
    conditions,
  }: Parameters<NonNullable<RuleModalProps['onChange']>>[0]) {
    setIsTracingDisabled(!!conditions.length);
  }

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
      type: tracing ? DynamicSamplingRuleType.TRACE : DynamicSamplingRuleType.TRANSACTION,
      condition: {
        op: DynamicSamplingConditionOperator.AND,
        inner: !conditions.length ? [] : conditions.map(getNewCondition),
      },
      sampleRate: sampleRate / 100,
    };

    const newTransactionRules = ruleToUpdate
      ? rules.map(rule => (isEqual(rule, ruleToUpdate) ? newRule : rule))
      : [...rules, newRule];

    const [transactionTraceRules, individualTransactionRules] = partition(
      newTransactionRules,
      transactionRule => transactionRule.type === DynamicSamplingRuleType.TRACE
    );

    const newRules = [...transactionTraceRules, ...individualTransactionRules];

    const currentRuleIndex = newRules.findIndex(newR => newR === newRule);
    submitRules(newRules, currentRuleIndex);
  }

  return (
    <RuleModal
      {...props}
      title={
        ruleToUpdate
          ? t('Edit Transaction Sampling Rule')
          : t('Add Transaction Sampling Rule')
      }
      emptyMessage={t('Apply sampling rate to all transactions')}
      conditionCategories={generateConditionCategoriesOptions(
        tracing
          ? [
              DynamicSamplingInnerName.TRACE_RELEASE,
              DynamicSamplingInnerName.TRACE_ENVIRONMENT,
              DynamicSamplingInnerName.TRACE_USER_ID,
              DynamicSamplingInnerName.TRACE_USER_SEGMENT,
              DynamicSamplingInnerName.TRACE_TRANSACTION,
            ]
          : [
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
            ]
      )}
      rule={ruleToUpdate}
      onSubmit={handleSubmit}
      onChange={handleChange}
      extraFields={
        <Field
          label={t('Tracing')}
          inline={false}
          flexibleControlStateSize
          stacked
          showHelpInTooltip
        >
          <Tooltip
            title={t('This field can only be edited if there are no match conditions')}
            disabled={!isTracingDisabled}
            overlayStyle={css`
              @media (min-width: ${theme.breakpoints[0]}) {
                max-width: 370px;
              }
            `}
          >
            <TracingWrapper
              onClick={isTracingDisabled ? undefined : () => setTracing(!tracing)}
            >
              <StyledCheckboxFancy isChecked={tracing} isDisabled={isTracingDisabled} />
              {tct(
                'Include all related transactions by trace ID. This can span across multiple projects. All related errors will remain. [link:Learn more about tracing].',
                {
                  link: (
                    <ExternalLink
                      href={DYNAMIC_SAMPLING_DOC_LINK}
                      onClick={event => event.stopPropagation()}
                    />
                  ),
                }
              )}
            </TracingWrapper>
          </Tooltip>
        </Field>
      }
    />
  );
}

export default TransactionRuleModal;

const TracingWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  cursor: ${p => (p.onClick ? 'pointer' : 'not-allowed')};
`;

const StyledCheckboxFancy = styled(CheckboxFancy)`
  margin-top: ${space(0.5)};
`;
