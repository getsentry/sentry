import React from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import space from 'app/styles/space';
import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';

import {
  RULE_TYPE,
  METHOD_TYPE,
  getRuleTypeSelectorFieldLabel,
  getMethodTypeSelectorFieldLabel,
} from '../utils';
import DataPrivacyRulesPanelSelectorField from './dataPrivacyRulesPanelFormSelectorField';
import DataPrivacyRulesPanelFormField from './dataPrivacyRulesPanelFormField';
import DataPrivacyRulesPanelFormSelectControl from './dataPrivacyRulesPanelFormSelectControl';
import DataPrivacyRulesPanelFormEventId from './dataPrivacyRulesPanelFormEventId';

type Rule = {
  id: number;
  type: RULE_TYPE;
  method: METHOD_TYPE;
  from: string;
  customRegularExpression?: string;
};

type DataPrivacyRulesPanelFormEventIdProps = React.ComponentProps<
  typeof DataPrivacyRulesPanelFormEventId
>;

type DataPrivacyRulesPanelSelectorFieldProps = React.ComponentProps<
  typeof DataPrivacyRulesPanelSelectorField
>;

type Props = DataPrivacyRulesPanelFormEventIdProps &
  Pick<DataPrivacyRulesPanelSelectorFieldProps, 'disabled' | 'selectorSuggestions'> & {
    rule: Rule;
    onChange: (rule: Rule) => void;
    onUpdateEventId: (eventId: string) => void;
  };

type State = {
  errors: {
    [key: string]: string;
  };
};
class DataPrivacyRulesForm extends React.PureComponent<Props, State> {
  state: State = {
    errors: {},
  };

  componentDidUpdate(prevProps: Props) {
    if (prevProps.rule.from !== this.props.rule.from) {
      this.handleValidation('from')();
    }
  }

  handleChange = <T extends keyof Omit<Rule, 'id'>>(stateProperty: T, value: Rule[T]) => {
    const rule: Rule = {
      ...this.props.rule,
      [stateProperty]: value,
    };

    if (rule.type !== RULE_TYPE.PATTERN) {
      delete rule.customRegularExpression;
    }

    this.props.onChange({
      ...rule,
    });
  };

  handleValidation = <T extends keyof Omit<Rule, 'id'>>(field: T) => () => {
    const errors = {...this.state.errors};
    const isFieldValueEmpty = !this.props.rule[field];
    const fieldErrorAlreadyExist = errors[field];

    if (isFieldValueEmpty && fieldErrorAlreadyExist) {
      return;
    }

    if (isFieldValueEmpty && !fieldErrorAlreadyExist) {
      errors[field] = t('Field Required');
    }

    if (!isFieldValueEmpty && fieldErrorAlreadyExist) {
      delete errors[field];
    }

    this.setState({
      errors,
    });
  };

  render() {
    const {rule, disabled, selectorSuggestions, onUpdateEventId, eventId} = this.props;
    const {from, customRegularExpression, type, method} = rule;
    const {errors} = this.state;

    return (
      <Wrapper>
        <WrapperSelectFields>
          <DataPrivacyRulesPanelFormField
            label={t('Method')}
            tooltipInfo={t('What to do')}
          >
            <DataPrivacyRulesPanelFormSelectControl
              placeholder={t('Select method')}
              name="method"
              options={sortBy(Object.values(METHOD_TYPE)).map(value => ({
                label: getMethodTypeSelectorFieldLabel(value),
                value,
              }))}
              value={method}
              onChange={({value}) => this.handleChange('method', value)}
              isDisabled={disabled}
            />
          </DataPrivacyRulesPanelFormField>
          <DataPrivacyRulesPanelFormField
            label={t('Data Type')}
            tooltipInfo={t(
              'What to look for. Use an existing pattern or define your own using regular expressions.'
            )}
          >
            <DataPrivacyRulesPanelFormSelectControl
              placeholder={t('Select type')}
              name="type"
              options={sortBy(Object.values(RULE_TYPE)).map(value => ({
                label: getRuleTypeSelectorFieldLabel(value),
                value,
              }))}
              value={type}
              onChange={({value}) => this.handleChange('type', value)}
              isDisabled={disabled}
            />
          </DataPrivacyRulesPanelFormField>
        </WrapperSelectFields>
        {type === RULE_TYPE.PATTERN && (
          <DataPrivacyRulesPanelFormField
            label={t('Regex matches')}
            tooltipInfo={t('Custom Perl-style regex (PCRE)')}
            isFullWidth
          >
            <CustomRegularExpression
              name="customRegularExpression"
              placeholder={t('[a-zA-Z0-9]+')}
              onChange={(value: string) => {
                this.handleChange('customRegularExpression', value);
              }}
              value={customRegularExpression}
              onBlur={this.handleValidation('customRegularExpression')}
              error={errors.customRegularExpression}
              disabled={disabled}
            />
          </DataPrivacyRulesPanelFormField>
        )}
        <DataPrivacyRulesPanelFormEventId
          onUpdateEventId={onUpdateEventId}
          eventId={eventId}
        />
        <DataPrivacyRulesPanelFormField
          label={t('Source')}
          tooltipInfo={t(
            'Where to look. In the simplest case this can be an attribute name.'
          )}
        >
          <DataPrivacyRulesPanelSelectorField
            onChange={(value: string) => {
              this.handleChange('from', value);
            }}
            value={from}
            onBlur={this.handleValidation('from')}
            selectorSuggestions={selectorSuggestions}
            error={errors.from}
            disabled={disabled}
          />
        </DataPrivacyRulesPanelFormField>
      </Wrapper>
    );
  }
}

export default DataPrivacyRulesForm;

const Wrapper = styled('div')`
  display: grid;
  grid-row-gap: ${space(2)};
`;

const WrapperSelectFields = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
  grid-template-columns: 1fr;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: auto auto;
  }
`;

const CustomRegularExpression = styled(TextField)`
  font-size: ${p => p.theme.fontSizeSmall};
  height: 34px;
  input {
    height: 34px;
    font-family: ${p => p.theme.text.familyMono};
  }
`;
