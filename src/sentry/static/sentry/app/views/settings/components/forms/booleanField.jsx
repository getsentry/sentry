import React from 'react';
import PropTypes from 'prop-types';

import InputField from './inputField';
import Switch from '../../../../components/switch';
import Confirm from '../../../../components/confirm';

export default class BooleanField extends InputField {
  static propTypes = {
    ...InputField.propTypes,
    confirm: PropTypes.node,
  };
  coerceValue(value) {
    return value ? true : false;
  }

  handleChange = (value, onChange, onBlur, e) => {
    // We need to toggle current value because Switch is not an input
    let newValue = this.coerceValue(!value);
    onChange(newValue, e);
    onBlur(newValue, e);
  };

  render() {
    let {confirm, ...fieldProps} = this.props;

    return (
      <InputField
        {...fieldProps}
        field={({onChange, onBlur, value, disabled, ...props}) => (
          <Confirm
            message={confirm}
            onConfirm={this.handleChange.bind(this, value, onChange, onBlur, {})}
          >
            {({open}) => (
              <Switch
                size="lg"
                {...props}
                isActive={!!value}
                isDisabled={disabled}
                toggle={e => {
                  // If we have a `confirm` prop and enabling switch
                  // Then show confirm dialog, otherwise propagate change as normal
                  if (!!confirm && !value) {
                    open();
                    return;
                  }

                  this.handleChange(value, onChange, onBlur, e);
                }}
              />
            )}
          </Confirm>
        )}
      />
    );
  }
}
