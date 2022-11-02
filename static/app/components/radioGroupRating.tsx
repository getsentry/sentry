import {useCallback, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {getButtonStyles} from 'sentry/components/button';
import Field from 'sentry/components/forms/field';
import {FieldGroupProps} from 'sentry/components/forms/field/types';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Option = {label: string; description?: string};

export type RadioGroupRatingProps = Omit<FieldGroupProps, 'children'> & {
  /**
   * Field name, used in all radio group elements
   */
  name: string;
  /**
   * An object of options, where the label is used for the aria-label,
   * the key is used for the selection and
   * the optional description to provide more context
   */
  options: Record<string, Option>;
  /**
   * The key of the option that should be selected by default
   */
  defaultValue?: string;
  /**
   * Callback function that is called when the selection changes.
   * its value is the key of the selected option
   */
  onChange?: (value: string) => void;
};

// Used to provide insights regarding opinions and experiences.
// Currently limited to numeric options only, but can be updated to meet other needs.
export function RadioGroupRating({
  options,
  name,
  onChange,
  defaultValue,
  ...fieldProps
}: RadioGroupRatingProps) {
  const [selectedOption, setSelectedOption] = useState(defaultValue);

  const handleClickedOption = useCallback(
    (value: string) => {
      setSelectedOption(value);
      onChange?.(value);
    },
    [onChange]
  );

  return (
    <Field {...fieldProps}>
      <Wrapper totalOptions={Object.keys(options).length}>
        {Object.entries(options).map(([key, option], index) => (
          <OptionWrapper key={key}>
            <Label
              selected={key === selectedOption}
              htmlFor={key}
              onClick={() => handleClickedOption(key)}
              aria-label={t('Select option %s', option.label)}
            >
              {index + 1}
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
  grid-template-columns: repeat(auto-fit, minmax(50px, 1fr));
  margin-top: ${space(0.5)};
  gap: ${space(1)};
`;

const OptionWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-direction: column;
`;

const Label = styled('label')<{'aria-label': string; selected: boolean}>`
  cursor: pointer;
  ${p => css`
    ${getButtonStyles({
      theme: p.theme,
      size: 'md',
      'aria-label': p['aria-label'],
      priority: p.selected ? 'primary' : 'default',
    })}
  `}
`;

const Description = styled('div')`
  text-align: center;
`;
