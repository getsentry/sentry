import {Component} from 'react';

import Confirm from 'sentry/components/confirm';
import {Switch} from 'sentry/components/core/switch';
import FormField from 'sentry/components/forms/formField';
import {Tooltip} from 'sentry/components/tooltip';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps, OnEvent} from './inputField';

export interface BooleanFieldProps extends InputFieldProps {
  confirm?: {
    false?: React.ReactNode;
    isDangerous?: boolean;
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
    const {confirm, ...fieldProps} = this.props;

    return (
      <FormField {...fieldProps} resetOnError>
        {({
          children: _children,
          onChange,
          onBlur,
          value,
          disabled,
          disabledReason,
          ...props
        }: {
          disabled: boolean;
          disabledReason: boolean;
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
                // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                renderMessage={() => confirm[(!value).toString()]}
                onConfirm={() => handleChange({})}
                isDangerous={confirm.isDangerous}
              >
                {({open}) => (
                  <Tooltip title={disabledReason} skipWrapper disabled={!disabled}>
                    <Switch
                      {...switchProps}
                      onClick={(e: React.MouseEvent) => {
                        // If we have a `confirm` prop and enabling switch
                        // Then show confirm dialog, otherwise propagate change as normal
                        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
