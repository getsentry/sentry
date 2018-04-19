import React from 'react';
import PropTypes from 'prop-types';

import InputField from './inputField';
import Switch from '../../../../components/switch';
import Confirm from '../../../../components/confirm';

export default class BooleanField extends InputField {
  static propTypes = {
    ...InputField.propTypes,
    confirm: PropTypes.shape({
      true: PropTypes.node,
      false: PropTypes.node,
    }),
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
        resetOnError
        field={({onChange, onBlur, value, disabled, ...props}) => {
          // Create a function with required args bound
          let handleChange = this.handleChange.bind(this, value, onChange, onBlur);

          let switchProps = {
            size: 'lg',
            ...props,
            isActive: !!value,
            isDisabled: disabled,
            toggle: handleChange,
          };

          if (confirm) {
            return (
              <Confirm
                renderMessage={() => confirm[!value]}
                onConfirm={() => handleChange({})}
              >
                {({open}) => (
                  <Switch
                    {...switchProps}
                    toggle={e => {
                      // If we have a `confirm` prop and enabling switch
                      // Then show confirm dialog, otherwise propagate change as normal
                      if (confirm[!value]) {
                        // Open confirm modal
                        open();
                        return;
                      }

                      handleChange(e);
                    }}
                  />
                )}
              </Confirm>
            );
          }

          return <Switch {...switchProps} />;
        }}
      />
    );
  }
}
