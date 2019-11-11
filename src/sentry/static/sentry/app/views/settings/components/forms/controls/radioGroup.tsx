import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';

import {growIn} from 'app/styles/animations';

const RadioGroup = ({value, disabled, choices, label, onChange, ...props}) => {
  const isSelected = id => {
    return value ? value === id : id === 0;
  };

  return (
    <div {...props} role="radiogroup" aria-labelledby={label}>
      {(choices || []).map(([id, name, description], index) => (
        <RadioLineItem
          key={index}
          onClick={e => !disabled && onChange(id, e)}
          role="radio"
          index={index}
          aria-checked={isSelected(id)}
          disabled={disabled}
        >
          <RadioLineButton type="button" disabled={disabled}>
            {isSelected(id) && (
              <RadioLineButtonFill disabled={disabled} animate={value !== ''} />
            )}
          </RadioLineButton>
          <RadioLineText disabled={disabled}>{name}</RadioLineText>
          {description && (
            <React.Fragment>
              <div />
              <Description>{description}</Description>
            </React.Fragment>
          )}
        </RadioLineItem>
      ))}
    </div>
  );
};

RadioGroup.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  choices: PropTypes.arrayOf(PropTypes.array),
  disabled: PropTypes.bool,
  label: PropTypes.string,
  onChange: PropTypes.func,
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

const RadioLineItem = styled('div', {shouldForwardProp})`
  display: grid;
  grid-gap: 0.25em 0.5em;
  grid-template-columns: max-content auto;
  align-items: center;
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  margin-top: ${p => (p.index ? '0.5em' : '0')};
  outline: none;
`;

const RadioLineButtonFill = styled('div', {shouldForwardProp})`
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background-color: ${p => p.theme.green};
  animation: ${p => (p.animate ? `0.2s ${growIn} ease` : 'none')};
  opacity: ${p => (p.disabled ? 0.4 : null)};
`;

const RadioLineText = styled('div', {shouldForwardProp})`
  opacity: ${p => (p.disabled ? 0.4 : null)};
`;

const Description = styled('div')`
  color: ${p => p.theme.gray1};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  line-height: 1.25em;
`;

export default RadioGroup;
