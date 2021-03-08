import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
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
    if (prevState.tracing !== this.state.tracing && !!this.state.conditions.length) {
      this.updateConditions();
    }

    if (prevState.transaction !== this.state.transaction) {
      this.setIsTracingDisabled(this.state.transaction !== Transaction.ALL);
    }

    super.componentDidUpdate(prevProps, prevState);
  }

  updateConditions() {
    this.setState(state => ({
      conditions: state.conditions.map(condition => ({
        ...condition,
        category: this.getNewConditionCategory(condition.category),
      })),
    }));
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

  getNewConditionCategory(category: DynamicSamplingInnerName) {
    const {tracing} = this.state;

    if (!tracing) {
      switch (category) {
        case DynamicSamplingInnerName.TRACE_RELEASE:
          return DynamicSamplingInnerName.EVENT_RELEASE;
        case DynamicSamplingInnerName.TRACE_USER:
          return DynamicSamplingInnerName.EVENT_USER;
        case DynamicSamplingInnerName.TRACE_ENVIRONMENT:
          return DynamicSamplingInnerName.EVENT_ENVIRONMENT;
        default: {
          Sentry.captureException(
            new Error('Unknown dynamic sampling rule condition category')
          );
          return category; //this shall not happen
        }
      }
    }

    switch (category) {
      case DynamicSamplingInnerName.EVENT_RELEASE:
        return DynamicSamplingInnerName.TRACE_RELEASE;
      case DynamicSamplingInnerName.EVENT_ENVIRONMENT:
        return DynamicSamplingInnerName.TRACE_ENVIRONMENT;
      case DynamicSamplingInnerName.EVENT_USER:
        return DynamicSamplingInnerName.TRACE_USER;
      default: {
        Sentry.captureException(
          new Error('Unknown dynamic sampling rule condition category')
        );
        return category; //this shall not happen
      }
    }
  }

  getCategoryOptions(): Array<[DynamicSamplingInnerName, string]> {
    const {tracing} = this.state;

    if (tracing) {
      return [
        [DynamicSamplingInnerName.TRACE_RELEASE, t('Releases')],
        [DynamicSamplingInnerName.TRACE_ENVIRONMENT, t('Environments')],
        [DynamicSamplingInnerName.TRACE_USER, t('Users')],
      ];
    }

    return [
      [DynamicSamplingInnerName.EVENT_RELEASE, t('Releases')],
      [DynamicSamplingInnerName.EVENT_ENVIRONMENT, t('Environments')],
      [DynamicSamplingInnerName.EVENT_USER, t('Users')],
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
