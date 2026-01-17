import Confirm from 'sentry/components/confirm';
import {Switch, type SwitchProps} from 'sentry/components/core/switch';
import {Tooltip} from 'sentry/components/core/tooltip';
import FormField from 'sentry/components/forms/formField';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps, OnEvent} from './inputField';

export interface BooleanFieldProps extends InputFieldProps {
  confirm?: {
    false?: React.ReactNode;
    isDangerous?: boolean;
    true?: React.ReactNode;
  };
}

export default function BooleanField({confirm, ...fieldProps}: BooleanFieldProps) {
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
        const handleChange = (
          e?: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>
        ) => {
          // We need to toggle current value because Switch is not an input
          const newValue = !value;
          onChange(newValue, e);
          onBlur(newValue, e);
        };

        const {type: _, ...propsWithoutType} = props;
        const switchProps: SwitchProps = {
          ...propsWithoutType,
          size: 'lg',
          checked: !!value,
          disabled,
          onChange: handleChange,
        };

        if (confirm) {
          return (
            <Confirm
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              renderMessage={() => confirm[(!value).toString()]}
              onConfirm={() => handleChange()}
              isDangerous={confirm.isDangerous}
            >
              {({open}) => (
                <Tooltip title={disabledReason} skipWrapper disabled={!disabled}>
                  <Switch
                    {...switchProps}
                    onChange={e => {
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
