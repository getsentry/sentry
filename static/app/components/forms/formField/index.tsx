import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Observer} from 'mobx-react';

import {Button} from 'sentry/components/button';
import type {AlertProps} from 'sentry/components/core/alert';
import PanelAlert from 'sentry/components/panels/panelAlert';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';

import FieldGroup from '../fieldGroup';
import type {FieldGroupProps} from '../fieldGroup/types';
import FormContext from '../formContext';
import type FormModel from '../model';
import {MockModel} from '../model';
import type {FieldValue} from '../types';

import FormFieldControlState from './controlState';

/**
 * Some fields don't need to implement their own onChange handlers, in
 * which case we will receive an Event, but if they do we should handle
 * the case where they return a value as the first argument.
 */
const getValueFromEvent = (valueOrEvent?: FieldValue | MouseEvent, e?: MouseEvent) => {
  const event = e || valueOrEvent;
  const value = defined(e) ? valueOrEvent : event?.target?.value;

  return {value, event};
};

/**
 * This is a list of field properties that can accept a function taking the
 * form model, that will be called to determine the value of the prop upon an
 * observed change in the model.
 *
 * This uses mobx's observation of the models observable fields.
 */

// !!Warning!! - the order of these props matters, as they are checked in order that they appear.
// One instance of a test that relies on this order is accountDetails.spec.tsx.
const propsToObserve = [
  'help',
  'highlighted',
  'inline',
  'visible',
  'disabled',
  'disabledReason',
] satisfies Array<keyof FormFieldProps>;

interface FormFieldPropModel extends FormFieldProps {
  model: FormModel;
}

type ObservedFn<T> = (props: FormFieldPropModel) => T;
type ObservedFnOrValue<T> = T | ObservedFn<T>;

type ObserverdPropNames = (typeof propsToObserve)[number];

type ObservedPropResolver = [
  ObserverdPropNames,
  () => ResolvedObservableProps[ObserverdPropNames],
];

/**
 * Construct the type for properties that may be given observed functions
 */
interface ObservableProps {
  disabled?: ObservedFnOrValue<FieldGroupProps['disabled']>;
  disabledReason?: ObservedFnOrValue<FieldGroupProps['disabledReason']>;
  help?: ObservedFnOrValue<FieldGroupProps['help']>;
  highlighted?: ObservedFnOrValue<FieldGroupProps['highlighted']>;
  inline?: ObservedFnOrValue<FieldGroupProps['inline']>;
  visible?: ObservedFnOrValue<FieldGroupProps['visible']>;
}

/**
 * The same ObservableProps, once they have been resolved
 */
interface ResolvedObservableProps {
  disabled?: FieldGroupProps['disabled'];
  disabledReason?: FieldGroupProps['disabledReason'];
  help?: FieldGroupProps['help'];
  highlighted?: FieldGroupProps['highlighted'];
  inline?: FieldGroupProps['inline'];
  visible?: FieldGroupProps['visible'];
}

// XXX(epurkhiser): Many of these props are duplicated in form types. The forms
// interfaces need some serious consolidation

interface BaseProps {
  /**
   * Used to render the actual control
   */
  children: (renderProps: any) => React.ReactNode;
  /**
   * Name of the field
   */
  name: string;
  // TODO(ts): These are actually props that are needed for some lower
  // component. We should let the rendering component pass these in instead
  defaultValue?: FieldValue;
  formatMessageValue?: boolean | Function;
  /**
   * Transform data when saving on blur.
   */
  getData?: (value: any) => any;
  /**
   * Should hide error message?
   */
  hideErrorMessage?: boolean;
  onBlur?: (value: any, event: any) => void;
  onChange?: (value: any, event: any) => void;
  onKeyDown?: (value: any, event: any) => void;
  placeholder?: ObservedFnOrValue<React.ReactNode>;

  resetOnError?: boolean;
  /**
   * The message to display when saveOnBlur is false
   */
  saveMessage?:
    | React.ReactNode
    | ((props: PassthroughProps & {value: FieldValue}) => React.ReactNode);
  /**
   * The alert type to use when saveOnBlur is false
   */
  saveMessageAlertType?: AlertProps['type'];
  /**
   * When the field is blurred should it automatically persist its value into
   * the model. Will show a confirm button 'save' otherwise.
   */
  saveOnBlur?: boolean;

  /**
   * A function producing an optional component with extra information.
   */
  selectionInfoFunction?: (
    props: PassthroughProps & {value: FieldValue; error?: string}
  ) => React.ReactNode;
  /**
   * Used in the form model to transform the value
   */
  setValue?: (value: FieldValue, props?: any) => any;
  /**
   * Extra styles to apply to the field
   */
  style?: React.CSSProperties;
  /**
   * Transform input when a value is set to the model.
   */
  transformInput?: (value: any) => any;
  // used in prettyFormString
  validate?: Function;
}

export interface FormFieldProps
  extends BaseProps,
    ObservableProps,
    Omit<FieldGroupProps, keyof ResolvedObservableProps | 'children'> {}

/**
 * ResolvedProps do NOT include props which may be given functions that are
 * reacted on. Resolved props are used inside of makeField.
 */
type ResolvedProps = BaseProps & FieldGroupProps;

type PassthroughProps = Omit<
  ResolvedProps,
  | 'children'
  | 'className'
  | 'name'
  | 'hideErrorMessage'
  | 'flexibleControlStateSize'
  | 'saveOnBlur'
  | 'saveMessage'
  | 'saveMessageAlertType'
  | 'selectionInfoFunction'
  | 'hideControlState'
  | 'defaultValue'
>;

function FormField(props: FormFieldProps) {
  const initialProps = useRef(props);

  const {name, onBlur, onChange, onKeyDown} = props;

  const context = useContext(FormContext);
  const inputRef = useRef<HTMLElement>();

  const [model] = useState<FormModel>(
    // XXX: MockModel doesn't fully implement the FormModel interface
    () => context.form ?? (new MockModel(props) as any)
  );

  // XXX(epurkhiser): This is a ***HUGE*** hack.
  //
  // When this was a class component it would re-create the MockModel every
  // time and inject the new props into it. Now that it's  a FC we cannot just
  // re-create the mockModel every time as it will invalidate many use*
  // dependnecies.
  //
  // We get around this by just updating the mock model props every render so
  // anything calling `getValue` or `getError` will have the latest controlled
  // values.
  //
  // TODO(epurkhiser): IN the future you should not be able to use anything
  // wrapping FormField without it being wrapped in a Form. There's just too
  // many things that break.
  if (context.form === undefined) {
    (model as any).props = props;
  }

  // Register field within the model
  useEffect(() => {
    model.setFieldDescriptor(name, initialProps.current);
    return () => model.removeField(name);
  }, [model, name]);

  /**
   * Update field value in form model
   */
  const handleChange = useCallback(
    (...args: any[]) => {
      const {value, event} = getValueFromEvent(...args);
      onChange?.(value, event);
      model.setValue(name, value);
    },
    [model, onChange, name]
  );

  /**
   * Notify model of a field being blurred
   */
  const handleBlur = useCallback(
    (...args: any[]) => {
      const {value, event} = getValueFromEvent(...args);

      onBlur?.(value, event);
      // Always call this, so model can decide what to do
      model.handleBlurField(name, value);
    },
    [model, onBlur, name]
  );

  /**
   * Handle keydown to trigger a save on Enter
   */
  const handleKeyDown = useCallback(
    (...args: any[]) => {
      const {value, event} = getValueFromEvent(...args);

      if (event.key === 'Enter') {
        model.handleBlurField(name, value);
      }

      onKeyDown?.(value, event);
    },
    [model, onKeyDown, name]
  );

  /**
   * Handle saving an individual field via UI button
   */
  const handleSaveField = useCallback(
    () => model.handleSaveField(name, model.getValue(name)),
    [model, name]
  );

  const handleCancelField = useCallback(
    () => model.handleCancelSaveField(name),
    [model, name]
  );

  /**
   * Attempts to autofocus input field if field's name is in url hash.
   *
   * The ref must be forwarded for this to work.
   */
  const handleInputMount = useCallback(
    (node: HTMLElement | null) => {
      if (node && !inputRef.current) {
        // TODO(mark) Clean this up. FormContext could include the location
        const hash = window.location?.hash;

        if (!hash) {
          return;
        }

        if (hash !== `#${name}`) {
          return;
        }

        // Not all form fields have this (e.g. Select fields)
        if (typeof node.focus === 'function') {
          node.focus();
        }
      }

      inputRef.current = node ?? undefined;
    },
    [name]
  );

  const id = useMemo(() => sanitizeQuerySelector(name), [name]);

  const makeField = useCallback(
    (resolvedObservedProps?: ResolvedObservableProps) => {
      const {
        className,
        hideErrorMessage,
        flexibleControlStateSize,
        saveMessage,
        saveMessageAlertType,
        selectionInfoFunction,
        // Don't pass `defaultValue` down to input fields, will be handled in
        // form model
        defaultValue: _defaultValue,
        children: _children,
        ...otherProps
      } = props;

      const fieldProps = {...otherProps, ...resolvedObservedProps} as PassthroughProps;

      const saveOnBlurFieldOverride =
        typeof props.saveOnBlur !== 'undefined' && !props.saveOnBlur;

      return (
        <Fragment>
          <FieldGroup
            id={id}
            className={className}
            flexibleControlStateSize={flexibleControlStateSize}
            controlState={
              <FormFieldControlState
                model={model}
                name={name}
                hideErrorMessage={hideErrorMessage}
              />
            }
            {...fieldProps}
          >
            <Observer>
              {() => {
                const error = model.getError(name);
                const value = model.getValue(name);

                return (
                  <Fragment>
                    {props.children({
                      ref: handleInputMount,
                      ...fieldProps,
                      model,
                      name,
                      id,
                      onKeyDown: handleKeyDown,
                      onChange: handleChange,
                      onBlur: handleBlur,
                      // Fixes react warnings about input switching from controlled to uncontrolled
                      // So force to empty string for null values
                      value: value === null ? '' : value,
                      error,
                      initialData: model.initialData,
                      'aria-describedby': `${id}_help`,
                      placeholder:
                        typeof fieldProps.placeholder === 'function'
                          ? fieldProps.placeholder({...props, model})
                          : fieldProps.placeholder,
                    })}
                  </Fragment>
                );
              }}
            </Observer>
          </FieldGroup>
          {selectionInfoFunction && (
            <Observer>
              {() => {
                const error = model.getError(name);
                const value = model.getValue(name);

                return (
                  <Fragment>
                    {fieldProps.visible
                      ? selectionInfoFunction({...fieldProps, error, value})
                      : null}
                  </Fragment>
                );
              }}
            </Observer>
          )}
          {saveOnBlurFieldOverride && (
            <Observer>
              {() => {
                const showFieldSave = model.getFieldState(name, 'showSave');
                const value = model.getValue(name);

                if (!showFieldSave) {
                  return null;
                }

                return (
                  <PanelAlert
                    type={saveMessageAlertType ?? 'info'}
                    trailingItems={
                      <Fragment>
                        <Button onClick={handleCancelField} size="xs">
                          {t('Cancel')}
                        </Button>
                        <Button priority="primary" size="xs" onClick={handleSaveField}>
                          {t('Save')}
                        </Button>
                      </Fragment>
                    }
                  >
                    {typeof saveMessage === 'function'
                      ? saveMessage({...fieldProps, value})
                      : saveMessage}
                  </PanelAlert>
                );
              }}
            </Observer>
          )}
        </Fragment>
      );
    },
    [
      handleBlur,
      handleCancelField,
      handleChange,
      handleInputMount,
      handleKeyDown,
      handleSaveField,
      id,
      model,
      name,
      props,
    ]
  );

  const observedProps = propsToObserve
    .filter(p => typeof props[p] === 'function')
    .map<ObservedPropResolver>(p => [
      p,
      () => (props[p] as ObservedFn<any>)({...props, model}),
    ]);

  // This field has no properties that require observation to compute their
  // value, this field is static and will not be re-rendered.
  if (observedProps.length === 0) {
    return makeField();
  }

  const resolveObservedProps = (
    resolvedProps: ResolvedObservableProps,
    [propName, resolve]: ObservedPropResolver
  ) => ({
    ...resolvedProps,
    [propName]: resolve(),
  });

  return (
    <Observer>{() => makeField(observedProps.reduce(resolveObservedProps, {}))}</Observer>
  );
}

export default FormField;
