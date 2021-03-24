import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';
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
  DynamicSamplingRuleType,
} from 'app/types/dynamicSampling';
import {Theme} from 'app/utils/theme';
import Field from 'app/views/settings/components/forms/field';

import {DYNAMIC_SAMPLING_DOC_LINK} from '../utils';

import Form from './form';
import {Transaction} from './utils';

type Props = Form['props'] & {
  theme: Theme;
};

type State = Form['state'] & {
  tracing: boolean;
  isTracingDisabled: boolean;
};

class TransactionRuleModal extends Form<Props, State> {
  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevState.transaction !== this.state.transaction) {
      this.setIsTracingDisabled(this.state.transaction !== Transaction.ALL);
    }

    super.componentDidUpdate(prevProps, prevState);
  }

  setIsTracingDisabled(isTracingDisabled: boolean) {
    this.setState({isTracingDisabled});
  }

  getDefaultState() {
    const {rule} = this.props;

    if (rule) {
      const {condition} = rule;
      const {inner} = condition;
      return {
        ...super.getDefaultState(),
        tracing: rule.type === DynamicSamplingRuleType.TRACE,
        isTracingDisabled: !!inner.length,
      };
    }

    return {
      ...super.getDefaultState(),
      tracing: true,
    };
  }

  getModalTitle() {
    const {rule} = this.props;

    if (rule) {
      return t('Edit a custom rule for transactions');
    }

    return t('Add a custom rule for transactions');
  }

  geTransactionFieldDescription() {
    return {
      label: t('Transaction'),
      // help: t('This is a description'),  TODO(Priscila): Add correct descriptions
    };
  }

  getCategoryOptions(): Array<[DynamicSamplingInnerName, string]> {
    const {tracing} = this.state;

    if (tracing) {
      return [
        [DynamicSamplingInnerName.TRACE_RELEASE, t('Releases')],
        [DynamicSamplingInnerName.TRACE_ENVIRONMENT, t('Environments')],
        [DynamicSamplingInnerName.TRACE_USER_ID, t('User Id')],
        [DynamicSamplingInnerName.TRACE_USER_SEGMENT, t('User Segment')],
      ];
    }

    return [
      [DynamicSamplingInnerName.EVENT_RELEASE, t('Releases')],
      [DynamicSamplingInnerName.EVENT_ENVIRONMENT, t('Environments')],
      [DynamicSamplingInnerName.EVENT_USER_ID, t('User Id')],
      [DynamicSamplingInnerName.EVENT_USER_SEGMENT, t('User Segment')],
      [DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS, t('Browser Extensions')],
      [DynamicSamplingInnerName.EVENT_LOCALHOST, t('Localhost')],
      [DynamicSamplingInnerName.EVENT_LEGACY_BROWSER, t('Legacy Browsers')],
      [DynamicSamplingInnerName.EVENT_WEB_CRAWLERS, t('Web Crawlers')],
    ];
  }

  getExtraFields() {
    const {theme} = this.props;
    const {tracing, isTracingDisabled} = this.state;

    return (
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
            onClick={
              isTracingDisabled ? undefined : () => this.handleChange('tracing', !tracing)
            }
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
    );
  }

  handleDeleteCondition = (index: number) => () => {
    const newConditions = [...this.state.conditions];
    newConditions.splice(index, 1);

    if (!newConditions.length) {
      this.setState({
        conditions: newConditions,
        transaction: Transaction.ALL,
        isTracingDisabled: false,
      });
      return;
    }

    this.setState({conditions: newConditions});
  };

  handleSubmit = () => {
    const {tracing, sampleRate, conditions, transaction} = this.state;

    if (!sampleRate) {
      return;
    }

    const {rule, errorRules, transactionRules} = this.props;

    const newRule: DynamicSamplingRule = {
      // All new/updated rules must have id equal to 0
      id: 0,
      type: tracing ? DynamicSamplingRuleType.TRACE : DynamicSamplingRuleType.TRANSACTION,
      condition: {
        op: DynamicSamplingConditionOperator.AND,
        inner:
          transaction === Transaction.ALL ? [] : conditions.map(this.getNewCondition),
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
    this.submitRules(newRules, currentRuleIndex);
  };
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
