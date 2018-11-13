import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import {growIn} from 'app/styles/animations';

const RadioGroup = ({value, choices, label, onChange, ...props}) => {
  const isSelected = id => {
    return value ? value === id : id === 0;
  };

  return (
    <div {...props} role="radiogroup" aria-labelledby={label}>
      {(choices || []).map(([id, name], index) => (
        <RadioLineItem
          key={index}
          onClick={e => onChange(id, e)}
          role="radio"
          index={index}
          tabIndex={isSelected(id) ? 0 : -1}
          aria-checked={isSelected(id)}
        >
          <RadioLineButton>
            {isSelected(id) && <RadioLineButtonFill animate={value !== ''} />}
          </RadioLineButton>
          <RadioLineText>{name}</RadioLineText>
        </RadioLineItem>
      ))}
    </div>
  );
};

RadioGroup.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  choices: PropTypes.arrayOf(PropTypes.array),
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

const RadioLineItem = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-top: ${p => (p.index ? '0.5em' : '0')};
  outline: none;

  :focus ${RadioLineButton} {
    border: 1px solid ${p => p.theme.borderDark};
  }
`;

const RadioLineButtonFill = styled.div`
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background-color: ${p => p.theme.green};
  animation: ${p => (p.animate ? `0.2s ${growIn} ease` : 'none')};
`;

const RadioLineText = styled.div`
  margin-left: 0.5em;
  font-size: 0.875em;
  font-weight: bold;
`;

export default RadioGroup;
