import {Key} from 'react';
import styled from '@emotion/styled';

import Field, {FieldProps} from 'sentry/components/forms/field';
import space from 'sentry/styles/space';

import CheckboxFancy from '../checkboxFancy/checkboxFancy';

type CheckboxOption<T> = {
  title: string;
  value: T;
  checked?: boolean;
  disabled?: boolean;
  intermediate?: boolean;
};

type Props<T> = Omit<FieldProps, 'children'> & {
  choices: CheckboxOption<T>[];
  onClick?: (item: T) => void;
  size?: string;
};

export default function MultipleCheckboxField<T extends Key>({
  choices,
  size,
  onClick,
  ...fieldProps
}: Props<T>) {
  return (
    <Field {...fieldProps}>
      {choices.map(option => (
        <CheckboxWrapper key={option.value.toString()}>
          <CheckboxFancy
            size={size}
            isDisabled={option.disabled}
            isChecked={option.checked}
            isIndeterminate={option.intermediate}
            onClick={() => {
              onClick?.(option.value);
            }}
          />
          <CheckboxText lineHeight={size}>{option.title}</CheckboxText>
        </CheckboxWrapper>
      ))}
    </Field>
  );
}

const CheckboxWrapper = styled('div')`
  margin-bottom: ${space(2)};
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const CheckboxText = styled('span')<{lineHeight?: string}>`
  margin-left: ${space(1)};
  /* line-height has to be the same as the checkbox size, so everything can be centered aligned */
  line-height: ${p => p.lineHeight ?? '16px'};
`;
