import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import InputField from './inputField';
import {growIn} from './styled/animations';

class RadioField extends InputField {
  static propTypes = {
    id: PropTypes.number,
    value: PropTypes.string,
    choices: PropTypes.func,
  };

  onChange = (value, onChange, onBlur, e) => {
    onChange(value, e);
    onBlur(value, e);
  };

  isSelected = ({value, id}) => {
    return value ? value === id : id === 0;
  };

  render() {
    return (
      <InputField
        {...this.props}
        field={({onChange, onBlur, value, disabled, ...props}) => (
          <div role="radiogroup" aria-labelledby={props.label}>
            {(props.choices() || []).map(([id, name], index) => {
              return (
                <RadioLineItem
                  key={index}
                  onClick={this.onChange.bind(this, id, onChange, onBlur)}
                  role="radio"
                  tabIndex={this.isSelected({value, id}) ? 0 : -1}
                  aria-checked={this.isSelected({value, id})}
                >
                  <RadioLineButton>
                    {this.isSelected({value, id}) && (
                      <RadioLineButtonFill animate={value !== ''} />
                    )}
                  </RadioLineButton>
                  <RadioLineText>{name}</RadioLineText>
                </RadioLineItem>
              );
            })}
          </div>
        )}
      />
    );
  }
}

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
  width: 54%;
  height: 54%;
  border-radius: 50%;
  background-color: ${p => p.theme.green};
  animation: ${p => (p.animate ? `0.2s ${growIn} ease` : 'none')};
`;

const RadioLineText = styled.div`
  margin-left: 0.5em;
  font-size: 0.875em;
  font-weight: bold;
`;

export default RadioField;
