import React from 'react';
import styled from '@emotion/styled';

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
import DataPrivacyRulesPanelSelectorField from './dataPrivacyRulesPanelSelectorField';
import {Suggestion} from './dataPrivacyRulesPanelSelectorFieldTypes';

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
  selectorSuggestions: Array<Suggestion>;
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
    const {onDelete, rule, disabled, selectorSuggestions} = this.props;
    const {from, customRegularExpression, type, method} = rule;
    const {errors} = this.state;

    return (
      <Wrapper>
        <WrapperFields>
          <StyledSelectControl
            placeholder={t('Select method')}
            name="method"
            options={Object.values(METHOD_TYPE).map(value => ({
              label: getMethodTypeSelectorFieldLabel(value),
              value,
            }))}
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
            value={type}
            onChange={({value}) => this.handleChange('type', value)}
            isDisabled={disabled}
            openOnFocus
            required
          />
          <From>
            <FromLabel disabled={disabled}>{t('from')}</FromLabel>
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
          </From>
          {type === RULE_TYPE.PATTERN && (
            <CustomRegularExpression
              name="customRegularExpression"
              placeholder={t('Enter custom regular expression')}
              onChange={(value: string) => {
                this.handleChange('customRegularExpression', value);
              }}
              value={customRegularExpression}
              onBlur={this.handleValidation('customRegularExpression')}
              error={errors.customRegularExpression}
              disabled={disabled}
            />
          )}
        </WrapperFields>
        {onDelete && (
          <StyledIconTrash
            disabled={disabled}
            size="small"
            onClick={this.handleDelete}
            fullHeight={type === RULE_TYPE.PATTERN}
          >
            <IconDelete />
          </StyledIconTrash>
        )}
      </Wrapper>
    );
  }
}

export default DataPrivacyRulesForm;

const Wrapper = styled('div')`
  padding: ${space(3)} ${space(2)};
  display: grid;
  grid-gap: ${space(2)};
  grid-template-columns: 1fr;
  align-items: flex-start;
  border-bottom: 1px solid ${p => p.theme.borderDark};

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: 1fr 40px;
  }
`;

const WrapperFields = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
  grid-row-gap: ${space(3)};
  align-items: flex-start;
  justify-items: start;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: 1fr 1fr;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: 200px 200px 1fr;
  }
`;

const FromLabel = styled('div')<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.gray5)};
  height: 100%;
  align-items: center;
  display: flex;
  width: 100%;
  justify-content: center;
`;

const From = styled('div')`
  display: grid;
  grid-template-columns: 40px 1fr;
  grid-column-end: -1;
  grid-column-start: 1;
  grid-gap: ${space(2)};
  width: 100%;
  height: 34px;

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-column-end: auto;
    grid-column-start: auto;
  }
`;

// TODO(Priscila): make possible to set min-height in the SelectControl
const StyledSelectControl = styled(SelectControl)<{isDisabled?: boolean}>`
  width: 100%;
  line-height: 18px;
  ${p =>
    p.isDisabled &&
    `
      cursor: not-allowed;
      pointer-events: auto;
    `}
  height: 34px;
  > *:first-child {
    height: 34px;
    min-height: 34px !important;
  }
`;

const CustomRegularExpression = styled(TextField)<{error?: string}>`
  grid-column-start: 1;
  grid-column-end: -1;
  width: 100%;
  font-size: ${p => p.theme.fontSizeSmall};
  height: 34px;
  input {
    height: 34px;
    font-family: ${p => p.theme.text.familyMono};
  }
  margin-bottom: 0;
`;

const StyledIconTrash = styled(Button)<{fullHeight?: boolean}>`
  color: ${p => p.theme.gray3};
  height: 100%;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    width: 40px;
    height: ${p => (p.fullHeight ? '100%' : '34px')};
  }
`;
