import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import Radio from 'app/components/radio';

type RadioGroupProps<C extends string> = {
  value: string | number | null;

  // An array of [id, name, description]
  choices: [C, React.ReactNode, React.ReactNode?][];
  disabled?: boolean;
  label: string;
  onChange: (id: C, e: React.FormEvent) => void;
};

type Props<C extends string> = RadioGroupProps<C> &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof RadioGroupProps<C>>;

const RadioGroup = <C extends string>({
  value,
  disabled,
  choices,
  label,
  onChange,
  ...props
}: Props<C>) => (
  <div {...props} role="radiogroup" aria-labelledby={label}>
    {(choices || []).map(([id, name, description], index) => (
      <RadioLineItem
        key={index}
        role="radio"
        index={index}
        aria-checked={value === id}
        disabled={disabled}
      >
        <Radio
          aria-label={id}
          disabled={disabled}
          checked={value === id}
          onChange={(e: React.FormEvent) => !disabled && onChange(id, e)}
        />
        <RadioLineText disabled={disabled}>{name}</RadioLineText>
        {description && (
          <React.Fragment>
            {/* If there is a description then we want to have a 2x2 grid so the first column width aligns with Radio Button */}
            <div />
            <Description>{description}</Description>
          </React.Fragment>
        )}
      </RadioLineItem>
    ))}
  </div>
);

RadioGroup.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  // TODO(ts): This is causing issues with ts
  choices: PropTypes.any.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

const shouldForwardProp = p => !['disabled', 'animate'].includes(p) && isPropValid(p);

const RadioLineItem = styled('label', {shouldForwardProp})<{
  disabled?: boolean;
  index: number;
}>`
  display: grid;
  grid-gap: 0.25em 0.5em;
  grid-template-columns: max-content auto;
  align-items: center;
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  margin-top: ${p => (p.index > 0 ? '0.5em' : '0')};
  outline: none;
  font-weight: normal;
`;

const RadioLineText = styled('div', {shouldForwardProp})<{disabled?: boolean}>`
  opacity: ${p => (p.disabled ? 0.4 : null)};
`;

const Description = styled('div')`
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  line-height: 1.4em;
`;

export default RadioGroup;
