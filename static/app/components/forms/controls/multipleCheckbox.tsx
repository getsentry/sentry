import * as React from 'react';
import styled from '@emotion/styled';

import {Choices} from 'sentry/types';
import {defined} from 'sentry/utils';

const MultipleCheckboxWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const Label = styled('label')`
  font-weight: normal;
  white-space: nowrap;
  margin-right: 10px;
  margin-bottom: 10px;
  width: 20%;
`;

const CheckboxLabel = styled('span')`
  margin-left: 3px;
`;

type SelectedValue = (string | number)[];

type Props = {
  choices: Choices;
  value: (string | number)[];
  disabled?: boolean;
  onChange?: (value: SelectedValue, event: React.ChangeEvent<HTMLInputElement>) => void;
};

class MultipleCheckbox extends React.Component<Props> {
  onChange = (selectedValue: string | number, e: React.ChangeEvent<HTMLInputElement>) => {
    const {value, onChange} = this.props;
    let newValue: SelectedValue = [];

    if (typeof onChange !== 'function') {
      return;
    }

    if (e.target.checked) {
      newValue = value ? [...value, selectedValue] : [value];
    } else {
      newValue = value.filter(v => v !== selectedValue);
    }

    onChange(newValue, e);
  };

  render() {
    const {disabled, choices, value} = this.props;

    return (
      <MultipleCheckboxWrapper>
        {choices.map(([choiceValue, choiceLabel]) => (
          <LabelContainer key={choiceValue}>
            <Label>
              <input
                type="checkbox"
                value={choiceValue}
                onChange={this.onChange.bind(this, choiceValue)}
                disabled={disabled}
                checked={defined(value) && value.indexOf(choiceValue) !== -1}
              />
              <CheckboxLabel>{choiceLabel}</CheckboxLabel>
            </Label>
          </LabelContainer>
        ))}
      </MultipleCheckboxWrapper>
    );
  }
}

export default MultipleCheckbox;

const LabelContainer = styled('div')`
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    width: 50%;
  }
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    width: 33.333%;
  }
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    width: 25%;
  }
`;
