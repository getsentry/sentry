import React from 'react';
import PropTypes from 'prop-types';

import RadioGroup from './radioGroup';
import InputField from './inputField';

class RadioField extends React.Component {
  static propTypes = {
    id: PropTypes.string,
    value: PropTypes.string,
    choices: PropTypes.arrayOf(PropTypes.array),
  };

  onChange = (id, onChange, onBlur, e) => {
    onChange(id, e);
    onBlur(id, e);
  };

  render() {
    return (
      <InputField
        {...this.props}
        field={({onChange, onBlur, value, disabled, ...props}) => (
          <RadioGroup
            choices={props.choices}
            value={value == '' ? null : value}
            label={props.label}
            onChange={(id, e) => this.onChange(id, onChange, onBlur, e)}
          />
        )}
      />
    );
  }
}

export default RadioField;
