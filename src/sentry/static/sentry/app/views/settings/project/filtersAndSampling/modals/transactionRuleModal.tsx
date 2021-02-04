import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {
  DynamicSamplingConditionOperator,
  DynamicSamplingInnerName,
  DynamicSamplingRule,
  DynamicSamplingRuleType,
} from 'app/types/dynamicSampling';
import Field from 'app/views/settings/components/forms/field';

import {DYNAMIC_SAMPLING_DOC_LINK} from '../utils';

import Form from './form';
import {Transaction} from './utils';

type Props = Form['props'];

type State = Form['state'] & {
  tracing: boolean;
};

class TransactionRuleModal extends Form<Props, State> {
  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevState.tracing !== this.state.tracing && !!this.state.conditions.length) {
      this.updateConditions();
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

  getDefaultState() {
    const {rule} = this.props;

    if (rule) {
      return {
        ...super.getDefaultState(),
        tracing: rule.type === DynamicSamplingRuleType.TRACE,
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
      help: t('This is a description'),
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
          Sentry.withScope(scope => {
            scope.setLevel(Sentry.Severity.Warning);
            Sentry.captureException(
              new Error('Unknown dynamic sampling rule condition category')
            );
          });
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
        Sentry.withScope(scope => {
          scope.setLevel(Sentry.Severity.Warning);
          Sentry.captureException(
            new Error('Unknown dynamic sampling rule condition category')
          );
        });
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
    ];
  }

  getExtraFields() {
    const {tracing} = this.state;
    return (
      <Field
        label={t('Tracing')}
        help={t('this is a description')}
        inline={false}
        flexibleControlStateSize
        stacked
        showHelpInTooltip
      >
        <TracingWrapper>
          <StyledCheckboxFancy
            onClick={() => this.handleChange('tracing', !tracing)}
            isChecked={tracing}
          />
          {tct(
            'Include all related transactions by trace ID. This can span across multiple projects. All related errors will remain. [link:Learn more about tracing].',
            {link: <ExternalLink href={DYNAMIC_SAMPLING_DOC_LINK} />}
          )}
        </TracingWrapper>
      </Field>
    );
  }

  handleAddCondition = () => {
    this.setState(state => ({
      conditions: [
        ...state.conditions,
        {
          category: state.tracing
            ? DynamicSamplingInnerName.TRACE_RELEASE
            : DynamicSamplingInnerName.EVENT_RELEASE,
          match: '',
        },
      ],
    }));
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

    const newRules = rule
      ? [
          ...errorRules,
          ...transactionRules.map(transactionRule =>
            isEqual(transactionRule, rule) ? newRule : transactionRule
          ),
        ]
      : [...errorRules, ...transactionRules, newRule];

    const currentRuleIndex = newRules.findIndex(newR => newR === newRule);
    this.submitRules(newRules, currentRuleIndex);
  };
}

export default TransactionRuleModal;

const TracingWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
`;

const StyledCheckboxFancy = styled(CheckboxFancy)`
  margin-top: ${space(0.5)};
`;
