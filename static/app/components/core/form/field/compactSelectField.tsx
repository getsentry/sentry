import {Fragment} from 'react';
import {mergeProps, mergeRefs} from '@react-aria/utils';

import {
  CompactSelect,
  type MultipleSelectProps,
  type SelectKey,
  type SelectOption,
  type SingleSelectProps,
} from '@sentry/scraps/compactSelect';
import {fieldComponent, type AnyFieldApi} from '@sentry/scraps/form/formHelpers';
import {useAutoSaveContext} from '@sentry/scraps/formPresentation';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {BaseFieldImpl, type BaseFieldProps} from './baseField';

type FieldOverrides = 'value' | 'onChange' | 'disabled' | 'onBlur' | 'id';

type CompactSelectFieldProps<TValue extends SelectKey> =
  BaseFieldProps<HTMLButtonElement> &
    (
      | (Omit<MultipleSelectProps<TValue>, FieldOverrides> & {
          onChange: (value: TValue[]) => void;
          value: TValue[];
        })
      | (Omit<Extract<SingleSelectProps<TValue>, {clearable: true}>, FieldOverrides> & {
          onChange: (value: TValue | null) => void;
          value: TValue | null;
        })
      | (Omit<Extract<SingleSelectProps<TValue>, {clearable?: false}>, FieldOverrides> & {
          onChange: (value: TValue) => void;
          value: TValue | null;
        })
    );

function CompactSelectField<TValue extends SelectKey>({
  disabled,
  field,
  ref,
  trigger,
  ...props
}: CompactSelectFieldProps<TValue> & {field: AnyFieldApi}) {
  const autoSaveContext = useAutoSaveContext();
  const selectProps = props.multiple
    ? {
        ...props,
        onChange: (options: Array<SelectOption<TValue>>) => {
          props.onChange(options.map(option => option.value));
        },
      }
    : props.clearable
      ? {
          ...props,
          value: props.value ?? undefined,
          onChange: (option: SelectOption<TValue> | undefined) => {
            props.onChange(option?.value ?? null);
            if (autoSaveContext) {
              field.handleBlur();
            }
          },
        }
      : {
          ...props,
          value: props.value ?? undefined,
          onChange: (option: SelectOption<TValue>) => {
            props.onChange(option.value);
            if (autoSaveContext) {
              field.handleBlur();
            }
          },
        };

  return (
    <BaseFieldImpl
      field={field}
      disabled={disabled ?? props.options.length === 0}
      ref={ref}
    >
      {(fieldProps, {indicator}) => (
        <Fragment>
          <Container flex={1} minWidth={0}>
            <CompactSelect
              {...selectProps}
              style={{width: '100%', ...props.style}}
              triggerId={fieldProps.id}
              disabled={fieldProps.disabled}
              onClose={() => {
                props.onClose?.();
                if (!autoSaveContext || props.multiple) {
                  field.handleBlur();
                }
              }}
              trigger={(triggerProps, isOpen) => {
                const mergedProps = mergeProps(
                  {style: {width: '100%'}},
                  triggerProps,
                  {
                    ...fieldProps,
                    onBlur: () => {
                      // Opening the menu moves focus from the trigger into the menu.
                      if (!isOpen) {
                        fieldProps.onBlur();
                      }
                    },
                  },
                  {ref: mergeRefs(triggerProps.ref, fieldProps.ref)}
                );
                return trigger ? (
                  trigger(mergedProps, isOpen)
                ) : (
                  <OverlayTrigger.Button {...mergedProps} />
                );
              }}
            />
          </Container>
          {indicator}
        </Fragment>
      )}
    </BaseFieldImpl>
  );
}

type CompactSelectLooseField = <TValue extends SelectKey>(
  props: CompactSelectFieldProps<TValue>
) => React.ReactNode;

export const CompactSelectLooseField = fieldComponent.loose(
  CompactSelectField,
  'field'
) as CompactSelectLooseField;
