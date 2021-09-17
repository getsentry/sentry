import {useState} from 'react';
import {css, withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import partition from 'lodash/partition';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import ExternalLink from 'app/components/links/externalLink';
import Tooltip from 'app/components/tooltip';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {
  DynamicSamplingConditionOperator,
  DynamicSamplingInnerName,
  DynamicSamplingRule,
  DynamicSamplingRules,
  DynamicSamplingRuleType,
} from 'app/types/dynamicSampling';
import {defined} from 'app/utils';
import {Theme} from 'app/utils/theme';
import Field from 'app/views/settings/components/forms/field';

import {DYNAMIC_SAMPLING_DOC_LINK} from '../utils';

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
  | 'onChage'
> & {
  theme: Theme;
  errorRules: DynamicSamplingRules;
  transactionRules: DynamicSamplingRules;
};

function TransactionRuleModal({
  rule,
  errorRules,
  transactionRules,
  theme,
  ...props
}: Props) {
  const [tracing, setTracing] = useState(true);
  const [isTracingDisabled, setIsTracingDisabled] = useState(false);

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

    const newTransactionRules = rule
      ? transactionRules.map(transactionRule =>
          isEqual(transactionRule, rule) ? newRule : transactionRule
        )
      : [...transactionRules, newRule];

    const [transactionTraceRules, individualTransactionRules] = partition(
      newTransactionRules,
      transactionRule => transactionRule.type === DynamicSamplingRuleType.TRACE
    );

    const newRules = [
      ...errorRules,
      ...transactionTraceRules,
      ...individualTransactionRules,
    ];

    const currentRuleIndex = newRules.findIndex(newR => newR === newRule);
    submitRules(newRules, currentRuleIndex);
  }

  return (
    <RuleModal
      {...props}
      title={
        rule ? t('Edit Transaction Sampling Rule') : t('Add Transaction Sampling Rule')
      }
      emptyMessage={t('Apply sampling rate to all transactions')}
      conditionCategories={
        tracing
          ? [
              [DynamicSamplingInnerName.TRACE_RELEASE, t('Releases')],
              [DynamicSamplingInnerName.TRACE_ENVIRONMENT, t('Environments')],
              [DynamicSamplingInnerName.TRACE_USER_ID, t('User Id')],
              [DynamicSamplingInnerName.TRACE_USER_SEGMENT, t('User Segment')],
              [DynamicSamplingInnerName.TRACE_TRANSACTION, t('Transactions')],
            ]
          : [
              [DynamicSamplingInnerName.EVENT_RELEASE, t('Releases')],
              [DynamicSamplingInnerName.EVENT_ENVIRONMENT, t('Environments')],
              [DynamicSamplingInnerName.EVENT_USER_ID, t('User Id')],
              [DynamicSamplingInnerName.EVENT_USER_SEGMENT, t('User Segment')],
              [
                DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS,
                t('Browser Extensions'),
              ],
              [DynamicSamplingInnerName.EVENT_LOCALHOST, t('Localhost')],
              [DynamicSamplingInnerName.EVENT_LEGACY_BROWSER, t('Legacy Browsers')],
              [DynamicSamplingInnerName.EVENT_WEB_CRAWLERS, t('Web Crawlers')],
              [DynamicSamplingInnerName.EVENT_IP_ADDRESSES, t('IP Addresses')],
              [DynamicSamplingInnerName.EVENT_CSP, t('Content Security Policy')],
              [DynamicSamplingInnerName.EVENT_ERROR_MESSAGES, t('Error Messages')],
              [DynamicSamplingInnerName.EVENT_TRANSACTION, t('Transactions')],
            ]
      }
      rule={rule}
      onSubmit={handleSubmit}
      onChange={handleChange}
      extraFields={
        <Field
          label={t('Tracing')}
          // help={t('this is a description')} // TODO(Priscila): Add correct descriptions
          inline={false}
          flexibleControlStateSize
          stacked
          showHelpInTooltip
        >
          <Tooltip
            title={t('This field can only be edited if there are no match conditions')}
            disabled={!isTracingDisabled}
            popperStyle={css`
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

export default withTheme(TransactionRuleModal);

const TracingWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  cursor: ${p => (p.onClick ? 'pointer' : 'not-allowed')};
`;

const StyledCheckboxFancy = styled(CheckboxFancy)`
  margin-top: ${space(0.5)};
`;
