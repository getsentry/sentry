import {Component, Fragment} from 'react';
import {Observer} from 'mobx-react';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import PanelAlert from 'sentry/components/panels/panelAlert';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';

import Field from '../field';
import FieldControl from '../field/fieldControl';
import FieldErrorReason from '../field/fieldErrorReason';
import {FieldGroupProps} from '../field/types';
import FormContext from '../formContext';
import FormModel, {MockModel} from '../model';
import {FieldValue} from '../types';

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
const propsToObserve = ['help', 'highlighted', 'inline', 'visible', 'disabled'] as const;

interface FormFieldPropModel extends FormFieldProps {
  model: FormModel;
}

type ObservedFn<_P, T> = (props: FormFieldPropModel) => T;
type ObservedFnOrValue<P, T> = T | ObservedFn<P, T>;

type ObservedPropResolver = [
  typeof propsToObserve[number],
  () => ResolvedObservableProps[typeof propsToObserve[number]]
];

/**
 * Construct the type for properties that may be given observed functions
 */
interface ObservableProps {
  disabled?: ObservedFnOrValue<{}, FieldGroupProps['disabled']>;
  help?: ObservedFnOrValue<{}, FieldGroupProps['help']>;
  highlighted?: ObservedFnOrValue<{}, FieldGroupProps['highlighted']>;
  inline?: ObservedFnOrValue<{}, FieldGroupProps['inline']>;
  visible?: ObservedFnOrValue<{}, FieldGroupProps['visible']>;
}

/**
 * The same ObservableProps, once they have been resolved
 */
interface ResolvedObservableProps {
  disabled?: FieldGroupProps['disabled'];
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
  children: (renderProps) => React.ReactNode;
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
  onBlur?: (value, event) => void;
  onChange?: (value, event) => void;
  onKeyDown?: (value, event) => void;
  placeholder?: ObservedFnOrValue<{}, React.ReactNode>;

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
  saveMessageAlertType?: React.ComponentProps<typeof Alert>['type'];
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

class FormField extends Component<FormFieldProps> {
  static defaultProps = {
    hideErrorMessage: false,
    flexibleControlStateSize: false,
  };

  componentDidMount() {
    // Tell model about this field's props
    this.getModel().setFieldDescriptor(this.props.name, this.props);
  }

  componentWillUnmount() {
    this.getModel().removeField(this.props.name);
  }

  static contextType = FormContext;

  getError() {
    return this.getModel().getError(this.props.name);
  }

  getId() {
    return sanitizeQuerySelector(this.props.name);
  }

  getModel(): FormModel {
    return this.context.form !== undefined
      ? this.context.form
      : new MockModel(this.props);
  }

  input: HTMLElement | null = null;

  /**
   * Attempts to autofocus input field if field's name is in url hash.
   *
   * The ref must be forwarded for this to work.
   */
  handleInputMount = (node: HTMLElement | null) => {
    if (node && !this.input) {
      // TODO(mark) Clean this up. FormContext could include the location
      const hash = window.location?.hash;

      if (!hash) {
        return;
      }

      if (hash !== `#${this.props.name}`) {
        return;
      }

      // Not all form fields have this (e.g. Select fields)
      if (typeof node.focus === 'function') {
        node.focus();
      }
    }

    this.input = node;
  };

  /**
   * Update field value in form model
   */
  handleChange = (...args) => {
    const {name, onChange} = this.props;
    const {value, event} = getValueFromEvent(...args);
    const model = this.getModel();

    if (onChange) {
      onChange(value, event);
    }

    model.setValue(name, value);
  };

  /**
   * Notify model of a field being blurred
   */
  handleBlur = (...args) => {
    const {name, onBlur} = this.props;
    const {value, event} = getValueFromEvent(...args);
    const model = this.getModel();

    if (onBlur) {
      onBlur(value, event);
    }

    // Always call this, so model can decide what to do
    model.handleBlurField(name, value);
  };

  /**
   * Handle keydown to trigger a save on Enter
   */
  handleKeyDown = (...args) => {
    const {onKeyDown, name} = this.props;
    const {value, event} = getValueFromEvent(...args);
    const model = this.getModel();

    if (event.key === 'Enter') {
      model.handleBlurField(name, value);
    }

    if (onKeyDown) {
      onKeyDown(value, event);
    }
  };

  /**
   * Handle saving an individual field via UI button
   */
  handleSaveField = () => {
    const {name} = this.props;
    const model = this.getModel();

    model.handleSaveField(name, model.getValue(name));
  };

  handleCancelField = () => {
    const {name} = this.props;
    const model = this.getModel();

    model.handleCancelSaveField(name);
  };

  render() {
    const {
      className,
      name,
      hideErrorMessage,
      flexibleControlStateSize,
      saveOnBlur,
      saveMessage,
      saveMessageAlertType,
      selectionInfoFunction,
      hideControlState,

      // Don't pass `defaultValue` down to input fields, will be handled in
      // form model
      defaultValue: _defaultValue,
      ...otherProps
    } = this.props;
    const id = this.getId();
    const model = this.getModel();
    const saveOnBlurFieldOverride = typeof saveOnBlur !== 'undefined' && !saveOnBlur;

    const makeField = (resolvedObservedProps?: ResolvedObservableProps) => {
      const props = {...otherProps, ...resolvedObservedProps} as PassthroughProps;

      return (
        <Fragment>
          <Field
            id={id}
            className={className}
            flexibleControlStateSize={flexibleControlStateSize}
            {...props}
          >
            {({alignRight, inline, disabled, disabledReason}) => (
              <FieldControl
                disabled={disabled}
                disabledReason={disabledReason}
                inline={inline}
                alignRight={alignRight}
                flexibleControlStateSize={flexibleControlStateSize}
                hideControlState={hideControlState}
                controlState={<FormFieldControlState model={model} name={name} />}
                errorState={
                  <Observer>
                    {() => {
                      const error = this.getError();
                      const shouldShowErrorMessage = error && !hideErrorMessage;
                      if (!shouldShowErrorMessage) {
                        return null;
                      }
                      return <FieldErrorReason>{error}</FieldErrorReason>;
                    }}
                  </Observer>
                }
              >
                <Observer>
                  {() => {
                    const error = this.getError();
                    const value = model.getValue(name);

                    return (
                      <Fragment>
                        {this.props.children({
                          ref: this.handleInputMount,
                          ...props,
                          model,
                          name,
                          id,
                          onKeyDown: this.handleKeyDown,
                          onChange: this.handleChange,
                          onBlur: this.handleBlur,
                          // Fixes react warnings about input switching from controlled to uncontrolled
                          // So force to empty string for null values
                          value: value === null ? '' : value,
                          error,
                          disabled,
                          initialData: model.initialData,
                          'aria-describedby': `${id}_help`,
                        })}
                      </Fragment>
                    );
                  }}
                </Observer>
              </FieldControl>
            )}
          </Field>
          {selectionInfoFunction && (
            <Observer>
              {() => {
                const error = this.getError();
                const value = model.getValue(name);

                const isVisible =
                  typeof props.visible === 'function'
                    ? props.visible({...this.props, ...props} as ResolvedProps)
                    : true;

                return (
                  <Fragment>
                    {isVisible ? selectionInfoFunction({...props, error, value}) : null}
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
                    type={saveMessageAlertType}
                    trailingItems={
                      <Fragment>
                        <Button onClick={this.handleCancelField} size="xs" type="button">
                          {t('Cancel')}
                        </Button>
                        <Button
                          priority="primary"
                          size="xs"
                          type="button"
                          onClick={this.handleSaveField}
                        >
                          {t('Save')}
                        </Button>
                      </Fragment>
                    }
                  >
                    {typeof saveMessage === 'function'
                      ? saveMessage({...props, value})
                      : saveMessage}
                  </PanelAlert>
                );
              }}
            </Observer>
          )}
        </Fragment>
      );
    };

    const observedProps = propsToObserve
      .filter(p => typeof this.props[p] === 'function')
      .map<ObservedPropResolver>(p => [
        p,
        () => (this.props[p] as ObservedFn<{}, any>)({...this.props, model}),
      ]);

    // This field has no properties that require observation to compute their
    // value, this field is static and will not be re-rendered.
    if (observedProps.length === 0) {
      return makeField();
    }

    const resolveObservedProps = (
      props: ResolvedObservableProps,
      [propName, resolve]: ObservedPropResolver
    ) => ({
      ...props,
      [propName]: resolve(),
    });

    return (
      <Observer>
        {() => makeField(observedProps.reduce(resolveObservedProps, {}))}
      </Observer>
    );
  }
}

export default FormField;
