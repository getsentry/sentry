import {Component} from 'react';

import Confirm from 'sentry/components/confirm';
import FormField from 'sentry/components/forms/formField';
import Switch from 'sentry/components/switchButton';
import {Tooltip} from 'sentry/components/tooltip';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import {InputFieldProps, OnEvent} from './inputField';

export interface BooleanFieldProps extends InputFieldProps {
  confirm?: {
    false?: React.ReactNode;
    true?: React.ReactNode;
  };
}

export default class BooleanField extends Component<BooleanFieldProps> {
  coerceValue(value: any) {
    return !!value;
  }

  handleChange = (
    value: any,
    onChange: OnEvent,
    onBlur: OnEvent,
    e: React.FormEvent<HTMLInputElement>
  ) => {
    // We need to toggle current value because Switch is not an input
    const newValue = this.coerceValue(!value);
    onChange(newValue, e);
    onBlur(newValue, e);
  };

  render() {
    const {confirm, disabledReason, ...fieldProps} = this.props;

    return (
      <FormField {...fieldProps} resetOnError>
        {({
          children: _children,
          onChange,
          onBlur,
          value,
          disabled,
          ...props
        }: {
          disabled: boolean;
          onBlur: OnEvent;
          onChange: OnEvent;
          type: string;
          value: any;
          children?: React.ReactNode;
        }) => {
          // Create a function with required args bound
          const handleChange = this.handleChange.bind(this, value, onChange, onBlur);

          const {type: _, ...propsWithoutType} = props;
          const switchProps = {
            ...propsWithoutType,
            size: 'lg' as React.ComponentProps<typeof Switch>['size'],
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
                  <Tooltip title={disabledReason} skipWrapper disabled={!disabled}>
                    <Switch
                      {...switchProps}
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
                  </Tooltip>
                )}
              </Confirm>
            );
          }

          return (
            <Tooltip title={disabledReason} skipWrapper disabled={!disabled}>
              <Switch {...switchProps} />
            </Tooltip>
          );
        }}
      </FormField>
    );
  }
}
