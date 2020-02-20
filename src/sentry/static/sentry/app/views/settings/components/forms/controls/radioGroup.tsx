import {css} from '@emotion/core';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import {growIn} from 'app/styles/animations';

type Props = {
  value: string | number | null;

  // An array of [id, name, description]
  choices: [string, React.ReactNode, React.ReactNode?][];
  disabled?: boolean;
  label: string;
  onChange: (id: string, e: React.MouseEvent) => void;
};

const RadioGroup = ({value, disabled, choices, label, onChange, ...props}: Props) => {
  return (
    <div {...props} role="radiogroup" aria-labelledby={label}>
      {(choices || []).map(([id, name, description], index) => {
        const isSelected = value === id;

        return (
          <RadioLineItem
            key={index}
            onClick={e => !disabled && onChange(id, e)}
            role="radio"
            index={index}
            aria-checked={isSelected}
            disabled={disabled}
          >
            <RadioLineButton aria-label={id} type="button" disabled={disabled}>
              {isSelected && (
                <RadioLineButtonFill disabled={disabled} animate={value !== ''} />
              )}
            </RadioLineButton>
            <RadioLineText disabled={disabled}>{name}</RadioLineText>
            {description && (
              <React.Fragment>
                {/* If there is a description then we want to have a 2x2 grid so the first column width aligns with Radio Button */}
                <div />
                <Description>{description}</Description>
              </React.Fragment>
            )}
          </RadioLineItem>
        );
      })}
    </div>
  );
};

RadioGroup.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  // TODO(ts): This is causing issues with ts
  choices: PropTypes.any.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

const RadioLineButton = styled('button')`
  display: flex;
  padding: 0;
  width: 1.5em;
  height: 1.5em;
  position: relative;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  border: 1px solid ${p => p.theme.borderLight};
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.04);
  background: none;

  &:focus,
  &.focus-visible {
    outline: none;
    border: 1px solid ${p => p.theme.borderDark};
    box-shadow: rgba(209, 202, 216, 0.5) 0 0 0 3px;
  }
`;

const shouldForwardProp = p => !['disabled', 'animate'].includes(p) && isPropValid(p);

const RadioLineItem = styled('div', {shouldForwardProp})<{
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
`;

const RadioLineButtonFill = styled('div', {shouldForwardProp})<{
  animate: boolean;
  disabled?: boolean;
}>`
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background-color: ${p => p.theme.green};
  ${p =>
    p.animate
      ? css`
          animation: 0.2s ${growIn} ease;
        `
      : 'animation: none'};
  opacity: ${p => (p.disabled ? 0.4 : null)};
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
