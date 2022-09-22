import {useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {getButtonStyles} from 'sentry/components/button';
import Field, {FieldProps} from 'sentry/components/forms/field';
import {t} from 'sentry/locale';

type Option = {label: string; description?: string};

type Props = Omit<FieldProps, 'children'> & {
  name: string;
  options: Record<string, Option>;
  defaultValue?: string;
  numericalLabels?: boolean;
  onChange?: (value: string) => void;
};

export function RadioGroupRating({
  options,
  name,
  onChange,
  defaultValue,
  numericalLabels = true,
  ...fieldProps
}: Props) {
  const [selectedOption, setSelectedOption] = useState(defaultValue);

  useEffect(() => {
    if (!selectedOption) {
      return;
    }
    onChange?.(selectedOption);
  }, [selectedOption, onChange]);

  return (
    <Field {...fieldProps}>
      <Wrapper totalOptions={Object.keys(options).length}>
        {Object.entries(options).map(([key, option], index) => (
          <OptionWrapper key={key}>
            <Label
              selected={key === selectedOption}
              htmlFor={key}
              onClick={() => setSelectedOption(key)}
              aria-label={t('Select option %s', option.label)}
            >
              {numericalLabels ? index + 1 : option.label}
            </Label>
            <HiddenInput type="radio" id={key} name={name} value={option.label} />
            <Description>{option.description}</Description>
          </OptionWrapper>
        ))}
      </Wrapper>
    </Field>
  );
}

const HiddenInput = styled('input')`
  display: none;
`;

const Wrapper = styled('div')<{totalOptions: number}>`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: ${p => 100 / p.totalOptions}%;
`;

const OptionWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-direction: column;
`;

const Label = styled('label')<{'aria-label': string; selected: boolean}>`
  cursor: pointer;
  ${p => css`
    ${getButtonStyles({theme: p.theme, size: 'md', 'aria-label': p['aria-label']})}
  `}
  ${p => p.selected && `background-color: ${p.theme.button.default.backgroundActive};`}
`;

const Description = styled('div')`
  text-align: center;
`;
