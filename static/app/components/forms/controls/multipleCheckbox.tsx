import {useCallback} from 'react';
import styled from '@emotion/styled';

import type {Choices} from 'sentry/types';
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

function MultipleCheckbox({choices, value, disabled, onChange}: Props) {
  const handleChange = useCallback(
    (selectedValue: string | number, e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [value, onChange]
  );

  return (
    <MultipleCheckboxWrapper>
      {choices.map(([choiceValue, choiceLabel]) => (
        <LabelContainer key={choiceValue}>
          <Label>
            <input
              type="checkbox"
              value={choiceValue}
              onChange={e => handleChange(choiceValue, e)}
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

export default MultipleCheckbox;

const LabelContainer = styled('div')`
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: 50%;
  }
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 33.333%;
  }
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    width: 25%;
  }
`;
