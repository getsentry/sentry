import {useCallback, useEffect, useLayoutEffect, useRef, type Ref} from 'react';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Container, Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import type {SelectValue} from '@sentry/scraps/select';
import type {Props as ReactSelectProps} from '@sentry/scraps/select/reactSelectWrapper';
import {components} from '@sentry/scraps/select/reactSelectWrapper';

import {BaseField, useAutoSaveIndicator, type BaseFieldProps} from './baseField';

function SelectInput({
  selectProps,
  ...props
}: React.ComponentProps<typeof components.Input> & {
  selectProps?: {'aria-invalid'?: boolean; inputRef?: Ref<{input: HTMLInputElement}>};
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reactSelectInnerRef = props.innerRef;
  // react-select types `innerRef` loosely; it receives the input element
  const innerRef = useCallback(
    (element: React.Ref<any>) => {
      inputRef.current = element as unknown as HTMLInputElement | null;
      reactSelectInnerRef(element);
    },
    [reactSelectInnerRef]
  );
  useFocusRestoreWhenReEnabled(inputRef, !!props.isDisabled);

  return (
    <components.Input
      {...props}
      innerRef={innerRef}
      {...{ref: selectProps?.inputRef}}
      aria-invalid={selectProps?.['aria-invalid']}
    />
  );
}

/**
 * react-select resets its internal `isFocused` state when it becomes disabled,
 * but the DOM input can keep focus since we no longer blur on select. A later
 * click then calls `focus()` on an already-focused input, no focus event fires,
 * and the menu never opens. Once re-enabled, re-sync by moving focus back onto
 * the input so react-select sees a real focus event and keyboard users keep
 * their place.
 */
function useFocusRestoreWhenReEnabled(
  inputRef: React.RefObject<HTMLInputElement | null>,
  isDisabled: boolean
) {
  const shouldRestoreFocusRef = useRef(false);

  // Some browsers move focus off the input themselves once it is disabled
  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    function onBlur() {
      if (input?.disabled) {
        shouldRestoreFocusRef.current = true;
      }
    }
    input.addEventListener('blur', onBlur);
    return () => input.removeEventListener('blur', onBlur);
  }, [inputRef]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    if (isDisabled) {
      if (document.activeElement === input) {
        shouldRestoreFocusRef.current = true;
      }
      return;
    }
    if (!shouldRestoreFocusRef.current) {
      return;
    }
    shouldRestoreFocusRef.current = false;
    if (document.activeElement === input) {
      // Stale DOM focus: blur first so the following focus() emits an event.
      // This is not a user blur, so don't let it reach the form's `onBlur`
      // (that would re-run validation or re-submit an auto-save form).
      resyncingFocusInputs.add(input);
      input.blur();
      resyncingFocusInputs.delete(input);
      // The input was focused a moment ago; always put focus back
      input.focus();
      return;
    }
    // The browser dropped focus on disable: only restore it if the user hasn't
    // moved somewhere else in the meantime
    if (!document.activeElement || document.activeElement === document.body) {
      input.focus();
    }
  }, [inputRef, isDisabled]);
}

/**
 * Inputs currently being blurred and re-focused only to re-sync react-select's
 * focus state. Their blur must not be treated as the user leaving the field.
 */
const resyncingFocusInputs = new WeakSet<EventTarget>();

function SelectIndicatorsContainer({children}: {children: React.ReactNode}) {
  const indicator = useAutoSaveIndicator();
  return (
    <Flex padding="0 sm" gap="sm" align="center">
      {indicator}
      {children}
    </Flex>
  );
}

// Base props shared by all select variants
type BaseSelectFieldProps<TValue, IsMulti extends boolean> = Omit<
  ReactSelectProps<SelectValue<TValue>, IsMulti>,
  | 'value'
  | 'onChange'
  | 'onBlur'
  | 'isDisabled'
  | 'isMulti'
  | 'isClearable'
  | 'id'
  | 'options'
> &
  BaseFieldProps<HTMLInputElement> & {
    options: ReadonlyArray<SelectValue<TValue>>;
    /**
     * Allows entering values that are not in `options`.
     */
    creatable?: boolean;
    /**
     * custom value comparator function
     * defaults to === comparison of the option values
     */
    isValueEqual?: (optionA: TValue, optionB: TValue) => boolean;
  };

// Helper type for non-array constraint
type NonArray<T> = T extends readonly unknown[] ? never : T;

// Single select WITHOUT clearable - onChange receives TValue (never null)
interface SingleUnclearableSelectFieldProps<TValue> extends BaseSelectFieldProps<
  TValue,
  false
> {
  onChange: (value: NonArray<TValue>) => void;
  value: NonArray<TValue> | null;
  clearable?: false;
  multiple?: false;
}

// Single select WITH clearable - onChange can receive TValue | null
interface SingleClearableSelectFieldProps<TValue> extends BaseSelectFieldProps<
  TValue,
  false
> {
  clearable: true;
  onChange: (value: NonArray<TValue> | null) => void;
  value: NonArray<TValue> | null;
  multiple?: false;
}

// Multiple select - TValue must be an array
interface MultipleSelectFieldProps<
  TValue extends NonArray<any>,
> extends BaseSelectFieldProps<TValue, true> {
  multiple: true;
  onChange: (value: TValue[]) => void;
  value: TValue[];
  clearable?: boolean;
}

export type SelectFieldProps<TValue> =
  | SingleUnclearableSelectFieldProps<TValue>
  | SingleClearableSelectFieldProps<TValue>
  | MultipleSelectFieldProps<TValue>;

// HACK: react-select types are bad, ref is a custom StateManager
// This converts the `ref` value of SelectInput into a format
// that works for BaseField, which expects `fieldProps.ref: Ref<HTMLElement>`
const applyInputToRef =
  (ref: Ref<HTMLInputElement>) =>
  (instance: null | {input: HTMLInputElement}): void => {
    if (instance) {
      if (typeof ref === 'function') {
        ref(instance.input);
      } else if (ref) {
        ref.current = instance.input;
      }
    }
  };

export function SelectField<TValue>({
  onChange,
  disabled,
  multiple,
  clearable,
  value,
  ref,
  ...props
}: BaseFieldProps<HTMLInputElement> & SelectFieldProps<TValue>) {
  const autoSaveContext = useAutoSaveContext();
  const selectVariantProps = multiple
    ? {multiple: true as const, clearable, value}
    : clearable
      ? {clearable: true as const, value}
      : {value};

  // Track whether the menu is open for multi-select auto-save behavior
  const isMenuOpenRef = useRef(false);

  return (
    <BaseField disabled={disabled} ref={ref}>
      {({id, ref: fieldRef, ...fieldProps}) => (
        <Container flex={1} minWidth={0}>
          <Select
            {...fieldProps}
            {...props}
            {...selectVariantProps}
            onBlur={(event: React.FocusEvent<HTMLElement>) => {
              if (!resyncingFocusInputs.has(event.target)) {
                fieldProps.onBlur();
              }
            }}
            inputId={id}
            inputRef={applyInputToRef(fieldRef)}
            // Keep focus on the input after selecting so keyboard users don't lose
            // their place. We call `onBlur` manually on select instead.
            blurInputOnSelect={false}
            components={
              {
                ...props.components,
                Input: SelectInput,
                IndicatorsContainer: SelectIndicatorsContainer,
              } as never
            }
            onMenuOpen={() => {
              isMenuOpenRef.current = true;
              props.onMenuOpen?.();
            }}
            onMenuClose={() => {
              isMenuOpenRef.current = false;
              props.onMenuClose?.();
              // For multi-select in auto-save context, trigger save when menu closes
              if (multiple && autoSaveContext) {
                fieldProps.onBlur();
              }
            }}
            onChange={(
              option: SelectValue<TValue> | Array<SelectValue<TValue>> | null
            ) => {
              if (multiple) {
                // For multi-select, option is an array
                onChange(Array.isArray(option) ? option.map(o => o.value) : []);
                // For multi-select in auto-save context, trigger save when menu is closed
                // (e.g., clicking X on a tag or clear all while menu is not open)
                if (autoSaveContext && !isMenuOpenRef.current) {
                  fieldProps.onBlur();
                }
              } else {
                if (!option) {
                  // Clearable single select - type system allows null via discriminated union
                  (onChange as (value: TValue | null) => void)(null);
                  fieldProps.onBlur();
                  return;
                }
                // For single-select, option is a single value
                (onChange as (value: TValue) => void)(
                  (option as SelectValue<TValue>).value
                );
                // Selecting is a commit: run blur validation (and auto-save)
                fieldProps.onBlur();
              }
            }}
          />
        </Container>
      )}
    </BaseField>
  );
}
