import React from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import space from 'app/styles/space';
import {t} from 'app/locale';
import SelectControl from 'app/components/forms/selectControl';
import TextField from 'app/components/forms/textField';
import {IconDelete} from 'app/icons/iconDelete';
import Button from 'app/components/button';

import {
  RULE_TYPE,
  METHOD_TYPE,
  getRuleTypeSelectorFieldLabel,
  getMethodTypeSelectorFieldLabel,
} from './utils';

type Rule = {
  id: number;
  type: RULE_TYPE;
  method: METHOD_TYPE;
  from: string;
  customRegularExpression?: string;
};

type Props = {
  onDelete: (ruleId: Rule['id']) => void;
  onChange: (rule: Rule) => void;
  rule: Rule;
  disabled?: boolean;
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

  handleChange = <T extends keyof Omit<Rule, 'id'>>(stateProperty: T, value: Rule[T]) => {
    const rule: Rule = {
      ...omit(this.props.rule, 'customRegularExpression'),
      [stateProperty]: value,
    };

    if (stateProperty === 'type' && value === RULE_TYPE.PATTERN) {
      rule.customRegularExpression = this.props.rule.customRegularExpression || '';
    }

    this.props.onChange({
      ...rule,
    });
  };

  handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    const {onDelete, rule} = this.props;
    onDelete(rule.id);
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
    const {onDelete, rule, disabled} = this.props;
    const {from, customRegularExpression, type, method} = rule;
    const {errors} = this.state;

    return (
      <Wrapper hasError={Object.keys(errors).length > 0}>
        <WrapperFields>
          <StyledSelectControl
            placeholder={t('Select method')}
            name="method"
            options={Object.values(METHOD_TYPE).map(value => ({
              label: getMethodTypeSelectorFieldLabel(value),
              value,
            }))}
            height={40}
            value={method}
            onChange={({value}) => this.handleChange('method', value)}
            isDisabled={disabled}
            openOnFocus
            required
          />
          <StyledSelectControl
            placeholder={t('Select type')}
            name="type"
            options={Object.values(RULE_TYPE).map(value => ({
              label: getRuleTypeSelectorFieldLabel(value),
              value,
            }))}
            height={40}
            value={type}
            onChange={({value}) => this.handleChange('type', value)}
            isDisabled={disabled}
            openOnFocus
            required
          />
          <From disabled={disabled}>{t('from')}</From>
          <StyledTextField
            name="from"
            placeholder={t('ex. strings, numbers, custom')}
            onChange={(value: string) => {
              this.handleChange('from', value);
            }}
            value={from}
            inputStyle={{
              height: '100%',
            }}
            onBlur={this.handleValidation('from')}
            error={errors.from}
            disabled={disabled}
          />
          {type === RULE_TYPE.PATTERN && (
            <CustomRegularExpression
              name="customRegularExpression"
              placeholder={t('Enter custom regular expression')}
              onChange={(value: string) => {
                this.handleChange('customRegularExpression', value);
              }}
              value={customRegularExpression}
              inputStyle={{
                height: '100%',
              }}
              onBlur={this.handleValidation('customRegularExpression')}
              error={errors.customRegularExpression}
              disabled={disabled}
            />
          )}
        </WrapperFields>
        {onDelete && (
          <StyledIconTrash disabled={disabled} onClick={this.handleDelete}>
            <IconDelete />
          </StyledIconTrash>
        )}
      </Wrapper>
    );
  }
}

export default DataPrivacyRulesForm;

const Wrapper = styled('div')<{hasError?: boolean}>`
  padding: ${p => `${space(p.hasError ? 4 : 2)} ${space(3)}`};
  display: grid;
  grid-gap: ${space(2)};
  grid-template-columns: 1fr 40px;
  align-items: center;
  border-bottom: 1px solid ${p => p.theme.borderDark};
`;

const WrapperFields = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
  align-items: center;
  justify-items: start;

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: minmax(157px, 1fr) minmax(300px, 1fr);
    justify-items: end;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: minmax(157px, 1fr) minmax(300px, 1fr) max-content minmax(
        300px,
        1fr
      );
    justify-items: start;
  }
`;

const From = styled('div')<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.gray5)};
`;

const StyledSelectControl = styled(SelectControl)<{isDisabled?: boolean}>`
  width: 100%;
  height: 100%;
  ${p =>
    p.isDisabled &&
    `
      cursor: not-allowed;
      pointer-events: auto;
    `}
`;

const StyledTextField = styled(TextField)<{error?: string}>`
  width: 100%;
  height: 40px;
  > * {
    height: 100%;
    min-height: 100%;
  }
  ${p =>
    !p.error &&
    `
      margin-bottom: 0;
    `}
`;

const CustomRegularExpression = styled(StyledTextField)`
  grid-column-start: 1;
  grid-column-end: -1;
  font-family: ${p => p.theme.text.familyMono};
`;

const StyledIconTrash = styled(Button)`
  color: ${p => p.theme.gray3};
  width: 40px;
  height: 100%;
`;
