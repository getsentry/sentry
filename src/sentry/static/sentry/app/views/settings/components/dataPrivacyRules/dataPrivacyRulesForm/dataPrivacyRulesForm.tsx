import React from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import space from 'app/styles/space';
import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';

import {getRuleTypeLabel, getMethodTypeLabel} from './utils';
import {RuleType, MethodType} from './types';
import DataPrivacyRulesFormSource from './dataPrivacyRulesFormSource';
import DataPrivacyRulesFormField from './dataPrivacyRulesFormField';
import DataPrivacyRulesFormSelectControl from './dataPrivacyRulesFormSelectControl';
import DataPrivacyRulesFormEventId from './dataPrivacyRulesFormEventId';

type Rule = {
  id: number;
  type: RuleType;
  method: MethodType;
  source: string;
  customRegularExpression?: string;
};

type EventIdProps = React.ComponentProps<typeof DataPrivacyRulesFormEventId>;
type SourceProps = React.ComponentProps<typeof DataPrivacyRulesFormSource>;
type Errors = {
  customRegularExpression?: string;
  source?: string;
};
type Error = keyof Errors;

type Props = EventIdProps & {
  rule: Rule;
  sourceSuggestions: SourceProps['suggestions'];
  onChange: (rule: Rule) => void;
  onUpdateEventId: (eventId: string) => void;
  errors: Errors;
};

type State = {
  errors: Errors;
};
class DataPrivacyRulesForm extends React.PureComponent<Props, State> {
  state: State = {
    errors: {},
  };

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.errors, this.props.errors)) {
      this.updateErrors();
    }
  }

  updateErrors = () => {
    this.setState({
      errors: this.props.errors || {},
    });
  };

  clearError = (error: Error) => {
    this.setState(prevState => ({
      errors: omit(prevState.errors, error),
    }));
  };

  handleChange = <T extends keyof Omit<Rule, 'id'>>(stateProperty: T, value: Rule[T]) => {
    const rule: Rule = {
      ...this.props.rule,
      [stateProperty]: value,
    };

    if (rule.type !== RuleType.PATTERN) {
      delete rule.customRegularExpression;
    }

    if (stateProperty === 'customRegularExpression' || stateProperty === 'source') {
      this.clearError(stateProperty as Error);
    }

    if (
      this.state.errors?.customRegularExpression &&
      stateProperty === 'type' &&
      value === RuleType.PATTERN
    ) {
      this.clearError('customRegularExpression' as Error);
    }

    this.props.onChange({
      ...rule,
    });
  };

  handleValidation = <T extends keyof Errors>(field: T) => () => {
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
    const {rule, disabled, sourceSuggestions, onUpdateEventId, eventId} = this.props;
    const {source, customRegularExpression, type, method} = rule;
    const {errors} = this.state;

    return (
      <Wrapper>
        <WrapperSelectFields>
          <DataPrivacyRulesFormField label={t('Method')} tooltipInfo={t('What to do')}>
            <DataPrivacyRulesFormSelectControl
              placeholder={t('Select method')}
              name="method"
              options={sortBy(Object.values(MethodType)).map(value => ({
                label: getMethodTypeLabel(value),
                value,
              }))}
              value={method}
              onChange={({value}) => this.handleChange('method', value)}
              isDisabled={disabled}
            />
          </DataPrivacyRulesFormField>
          <DataPrivacyRulesFormField
            label={t('Data Type')}
            tooltipInfo={t(
              'What to look for. Use an existing pattern or define your own using regular expressions.'
            )}
          >
            <DataPrivacyRulesFormSelectControl
              placeholder={t('Select type')}
              name="type"
              options={sortBy(Object.values(RuleType)).map(value => ({
                label: getRuleTypeLabel(value),
                value,
              }))}
              value={type}
              onChange={({value}) => this.handleChange('type', value)}
              isDisabled={disabled}
            />
          </DataPrivacyRulesFormField>
        </WrapperSelectFields>
        {type === RuleType.PATTERN && (
          <DataPrivacyRulesFormField
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
          </DataPrivacyRulesFormField>
        )}
        <DataPrivacyRulesFormEventId
          onUpdateEventId={onUpdateEventId}
          eventId={eventId}
        />
        <DataPrivacyRulesFormField
          label={t('Source')}
          tooltipInfo={t(
            'Where to look. In the simplest case this can be an attribute name.'
          )}
        >
          <DataPrivacyRulesFormSource
            onChange={(value: string) => {
              this.handleChange('source', value);
            }}
            value={source}
            onBlur={this.handleValidation('source')}
            suggestions={sourceSuggestions}
            error={errors.source}
            disabled={disabled}
          />
        </DataPrivacyRulesFormField>
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
  height: 40px;
  input {
    height: 40px;
    font-family: ${p => p.theme.text.familyMono};
  }
`;
