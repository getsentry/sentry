import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import {growIn} from 'app/styles/animations';

const RadioGroup = ({value, disabled, choices, label, onChange, ...props}) => {
  const isSelected = id => {
    return value ? value === id : id === 0;
  };

  return (
    <div {...props} role="radiogroup" aria-labelledby={label}>
      {(choices || []).map(([id, name], index) => (
        <RadioLineItem
          key={index}
          onClick={e => !disabled && onChange(id, e)}
          role="radio"
          index={index}
          tabIndex={isSelected(id) ? 0 : -1}
          aria-checked={isSelected(id)}
          disabled={disabled}
        >
          <RadioLineButton>
            {isSelected(id) && (
              <RadioLineButtonFill disabled={disabled} animate={value !== ''} />
            )}
          </RadioLineButton>
          <RadioLineText disabled={disabled}>{name}</RadioLineText>
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

const RadioLineButton = styled.div`
  width: 1.5em;
  height: 1.5em;
  position: relative;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${p => p.theme.borderLight};
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.04);
`;

const RadioLineItem = styled(({disabled, ...props}) => <div {...props} />)`
  display: flex;
  align-items: center;
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  margin-top: ${p => (p.index ? '0.5em' : '0')};
  outline: none;

  :focus ${RadioLineButton} {
    border: 1px solid ${p => p.theme.borderDark};
  }
`;

const RadioLineButtonFill = styled(({disabled, animate, ...props}) => <div {...props} />)`
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background-color: ${p => p.theme.green};
  animation: ${p => (p.animate ? `0.2s ${growIn} ease` : 'none')};
  opacity: ${p => (p.disabled ? 0.4 : null)};
`;

const RadioLineText = styled(({disabled, ...props}) => <div {...props} />)`
  margin-left: 0.5em;
  font-size: 0.875em;
  font-weight: bold;
  opacity: ${p => (p.disabled ? 0.4 : null)};
`;

export default RadioGroup;
