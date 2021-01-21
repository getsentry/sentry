import React from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {
  DynamicSamplingConditionOperator,
  DynamicSamplingRule,
} from 'app/types/dynamicSampling';
import {defined} from 'app/utils';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import NumberField from 'app/views/settings/components/forms/numberField';
import SelectField from 'app/views/settings/components/forms/selectField';

import MatchField from './matchField';

const conditionChoices = [
  [DynamicSamplingConditionOperator.ALL, t('All Transactions')],
  [DynamicSamplingConditionOperator.GLOB_MATCH, t('Releases')],
  [DynamicSamplingConditionOperator.STR_EQUAL_NO_CASE, t('Enviroments')],
  [DynamicSamplingConditionOperator.EQUAL, t('Users')],
];

type Props = ModalRenderProps & {
  organization: Organization;
  onSubmit: (rule: DynamicSamplingRule) => void;
  platformDocLink?: string;
};

type State = {
  tracing: boolean;
  condition: DynamicSamplingConditionOperator;
  match: string;
  sampleRate?: number;
};

class TransactionRuleModal extends React.Component<Props, State> {
  state: State = {
    tracing: true,
    condition: DynamicSamplingConditionOperator.ALL,
    match: '',
  };

  handleSubmit = async () => {
    const {sampleRate} = this.state;

    if (!defined(sampleRate)) {
      return;
    }

    // TODO(PRISCILA): Finalize this logic according to the new structure
  };

  handleSubmitSuccess = () => {};

  handleClickTracing = () => {
    this.setState(prevState => ({tracing: !prevState.tracing}));
  };

  handleChange = <T extends keyof State>(field: keyof State, value: State[T]) => {
    if (field === 'sampleRate') {
      this.setState(prevState => ({
        ...prevState,
        sampleRate: value ? Number(value) : undefined,
      }));
      return;
    }
    this.setState(prevState => ({...prevState, [field]: value}));
  };

  render() {
    const {Header, Body, closeModal, platformDocLink} = this.props;
    const {tracing, condition, sampleRate} = this.state;

    const submitDisabled = !defined(sampleRate);

    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Add a custom rule for transactions')}
        </Header>
        <Body>
          <Form
            submitLabel={t('Save')}
            onCancel={closeModal}
            apiEndpoint=""
            onSubmit={this.handleSubmit}
            initialData={{condition}}
            onFieldChange={this.handleChange as Form['props']['onFieldChange']}
            submitDisabled={submitDisabled}
            requireChanges
          >
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
                  onClick={this.handleClickTracing}
                  isChecked={tracing}
                />
                {platformDocLink
                  ? tct(
                      'Include all related transactions by trace ID. This can span across multiple projects. All related errors will remain. [link:Learn more about tracing].',
                      {link: <ExternalLink href={platformDocLink} />}
                    )
                  : t(
                      'Include all related transactions by trace ID. This can span across multiple projects. All related errors will remain.'
                    )}
              </TracingWrapper>
            </Field>
            <Field
              label={t('Condition')}
              help={t('this is a description')}
              inline={false}
              required
              flexibleControlStateSize
              stacked
              showHelpInTooltip
            >
              <SelectField
                name="condition"
                choices={conditionChoices}
                inline={false}
                hideControlState
                stacked
              />
            </Field>
            {condition !== DynamicSamplingConditionOperator.ALL && (
              <MatchField condition={condition} />
            )}
            <Field
              label={t('Sampling Rate')}
              help={t('this is a description')}
              inline={false}
              required
              flexibleControlStateSize
              stacked
              showHelpInTooltip
            >
              <NumberField name="sampleRate" inline={false} hideControlState stacked />
            </Field>
          </Form>
        </Body>
      </React.Fragment>
    );
  }
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
