import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import SelectControl from 'app/components/forms/selectControl';
import TextField from 'app/components/forms/textField';
import {IconDelete} from 'app/icons/iconDelete';
import Button from 'app/components/button';

import {
  getDataSelectorFieldLabel,
  getActionTypeSelectorFieldLabel,
  DataType,
  ALL_DATA_TYPES,
  ALL_ACTION_TYPES,
  ActionType,
} from './utils';

type Rule = {
  id: number;
  action: ActionType;
  data: DataType;
  from: string;
  customRegularExpression?: string;
};

type Props = {
  onDelete: (ruleId: Rule['id']) => void;
  onChange: (rule: Rule) => void;
  rule: Rule;
};

type State = {
  errors: {
    [key: string]: string;
  };
};
class ProjectDataPrivacyRulesForm extends React.PureComponent<Props, State> {
  state: State = {
    errors: {},
  };

  handleChange = <T extends keyof Omit<Rule, 'id'>>(stateProperty: T, value: Rule[T]) => {
    this.props.onChange({
      ...this.props.rule,
      [stateProperty]: value,
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
    const {onDelete, rule} = this.props;
    const {action, from, customRegularExpression, data} = rule;
    const {errors} = this.state;
    return (
      <Wrapper hasError={Object.keys(errors).length > 0}>
        <WrapperFields>
          <StyledSelectControl
            placeholder={t('Select an action')}
            name="action"
            options={ALL_ACTION_TYPES.map(value => ({
              label: getActionTypeSelectorFieldLabel(value),
              value,
            }))}
            height={40}
            value={action}
            onChange={({value}) => this.handleChange('action', value)}
            openOnFocus
            required
          />

          <StyledSelectControl
            placeholder={t('Select data')}
            name="data"
            options={ALL_DATA_TYPES.map(value => ({
              label: getDataSelectorFieldLabel(value),
              value,
            }))}
            height={40}
            value={data}
            onChange={({value}) => this.handleChange('data', value)}
            openOnFocus
            required
          />
          <From>{t('from')}</From>
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
          />
          {data === 'pattern' && (
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
            />
          )}
        </WrapperFields>
        {onDelete && (
          <StyledIconTrash onClick={this.handleDelete}>
            <IconDelete />
          </StyledIconTrash>
        )}
      </Wrapper>
    );
  }
}

export default ProjectDataPrivacyRulesForm;

const Wrapper = styled('div')<{hasError?: boolean}>`
  padding: ${p => `${space(p.hasError ? 4 : 2)} ${space(3)}`};
  display: grid;
  grid-gap: ${space(2)};
  grid-template-columns: 1fr 40px;
  align-items: center;
  border-bottom: 1px solid ${p => p.theme.offWhite2};
`;

const WrapperFields = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
  align-items: flex-start;

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: minmax(157px, 1fr) minmax(300px, 1fr);
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: minmax(157px, 1fr) minmax(300px, 1fr) max-content minmax(
        300px,
        1fr
      );
  }
`;

const From = styled('div')`
  height: 40px;
  display: flex;
  align-items: center;
`;

const StyledSelectControl = styled(SelectControl)`
  width: 100%;
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
  width: 40px;
  height: 100%;
`;
