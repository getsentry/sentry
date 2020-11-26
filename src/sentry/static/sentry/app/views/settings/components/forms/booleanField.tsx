import React from 'react';

import Confirm from 'app/components/confirm';
import Switch from 'app/components/switch';
import InputField, {onEvent} from 'app/views/settings/components/forms/inputField';

type Props = {
  confirm?: {
    true?: React.ReactNode;
    false?: React.ReactNode;
  };
} & InputField['props'];

export default class BooleanField extends React.Component<Props> {
  coerceValue(value: any) {
    return !!value;
  }

  handleChange = (
    value: any,
    onChange: onEvent,
    onBlur: onEvent,
    e: React.FormEvent<HTMLInputElement>
  ) => {
    // We need to toggle current value because Switch is not an input
    const newValue = this.coerceValue(!value);
    onChange(newValue, e);
    onBlur(newValue, e);
  };

  render() {
    const {confirm, ...fieldProps} = this.props;

    return (
      <InputField
        {...fieldProps}
        resetOnError
        field={({
          onChange,
          onBlur,
          value,
          disabled,
          ...props
        }: {
          onChange: onEvent;
          onBlur: onEvent;
          value: any;
          disabled: boolean;
        }) => {
          // Create a function with required args bound
          const handleChange = this.handleChange.bind(this, value, onChange, onBlur);

          const switchProps = {
            ...props,
            isActive: !!value,
            isDisabled: disabled,
            toggle: handleChange,
          };

          if (confirm) {
            return (
              <Confirm
                renderMessage={() => confirm[(!value).toString()]}
                onConfirm={() => handleChange({})}
              >
                {({open}) => (
                  <Switch
                    {...switchProps}
                    size="lg"
                    toggle={(e: React.MouseEvent) => {
                      // If we have a `confirm` prop and enabling switch
                      // Then show confirm dialog, otherwise propagate change as normal
                      if (confirm[(!value).toString()]) {
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
