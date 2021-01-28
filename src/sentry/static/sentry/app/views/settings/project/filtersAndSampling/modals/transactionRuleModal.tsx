import React from 'react';
import styled from '@emotion/styled';

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

import {DOC_LINK} from '../utils';

import Form from './form';

type Props = Form['props'];

type State = Form['state'] & {
  tracing: boolean;
};

class TransactionRuleModal extends Form<Props, State> {
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

  getCategoryOptions(): Array<[DynamicSamplingInnerName, string]> {
    const {tracing} = this.state;
    if (tracing) {
      return [
        [DynamicSamplingInnerName.TRACE_RELEASE, t('Releases')],
        [DynamicSamplingInnerName.TRACE_ENVIRONMENT, t('Environments')],
        [DynamicSamplingInnerName.TRACE_USER_SEGMENT, t('Users')],
      ];
    }
    return [
      [DynamicSamplingInnerName.EVENT_RELEASE, t('Releases')],
      [DynamicSamplingInnerName.EVENT_ENVIRONMENT, t('Environments')],
      [DynamicSamplingInnerName.EVENT_USER_SEGMENT, t('Users')],
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
            {link: <ExternalLink href={DOC_LINK} />}
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

  handleSubmit = async () => {
    const {tracing, sampleRate, conditions} = this.state;

    if (!sampleRate) {
      return;
    }

    const newRule: DynamicSamplingRule = {
      type: tracing ? DynamicSamplingRuleType.TRACE : DynamicSamplingRuleType.TRANSACTION,
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

export default TransactionRuleModal;

const TracingWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
`;

const StyledCheckboxFancy = styled(CheckboxFancy)`
  margin-top: ${space(0.5)};
`;
