import {Key} from 'react';
import styled from '@emotion/styled';

import space from 'sentry/styles/space';

import CheckboxFancy from '../checkboxFancy/checkboxFancy';

type CheckboxOption<T> = {
  title: string;
  value: T;
  checked?: boolean;
  disabled?: boolean;
  intermediate?: boolean;
};

type Props<T> = {
  choices: CheckboxOption<T>[];
  className?: string;
  onClick?(item: T);
  size?: string;
};

export default function MultipleCheckboxField<T extends Key>(props: Props<T>) {
  return (
    <div className={props.className}>
      {props.choices.map(option => (
        <CheckboxWrapper key={option.value.toString()}>
          <CheckboxFancy
            size={props.size}
            isDisabled={option.disabled}
            isChecked={option.checked}
            isIndeterminate={option.intermediate}
            onClick={() => {
              props.onClick?.(option.value);
            }}
          />
          <CheckboxText>{option.title}</CheckboxText>
        </CheckboxWrapper>
      ))}
    </div>
  );
}

const CheckboxWrapper = styled('div')`
  margin-bottom: ${space(2)};
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const CheckboxText = styled('span')`
  margin-left: ${space(1)};
`;
