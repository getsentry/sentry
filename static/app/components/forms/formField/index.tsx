import * as React from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Field from 'sentry/components/forms/field';
import FieldControl from 'sentry/components/forms/field/fieldControl';
import FieldErrorReason from 'sentry/components/forms/field/fieldErrorReason';
import FormContext from 'sentry/components/forms/formContext';
import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import FormModel, {MockModel} from 'sentry/components/forms/model';
import ReturnButton from 'sentry/components/forms/returnButton';
import PanelAlert from 'sentry/components/panels/panelAlert';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';

import {FieldValue} from '../type';

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
const propsToObserver = ['help', 'inline', 'highlighted', 'visible', 'disabled'] as const;

type PropToObserve = typeof propsToObserver[number];

type ObservedPropValue = Field['props'][PropToObserve];

type ObservedFn<P, T extends ObservedPropValue> = (
  props: Props<P> & {model: FormModel}
) => T;

type ObservedFnOrValue<P, T extends ObservedPropValue> = T | ObservedFn<P, T>;

/**
 * Construct the type for properties that may be given observed functions
 */
type ObservableProps<P> = {
  [T in PropToObserve]?: ObservedFnOrValue<P, Field['props'][T]>;
};

/**
 * The same ObservableProps, once they have been resolved
 */
type ResolvedObservableProps = {
  [T in PropToObserve]?: Field['props'][T];
};

type BaseProps<P> = {
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
  placeholder?: ObservedFnOrValue<P, React.ReactNode>;

  resetOnError?: boolean;
  /**
   * The message to display when saveOnBlur is false
   */
  saveMessage?:
    | React.ReactNode
    | ((props: PassthroughProps<P> & {value: FieldValue}) => React.ReactNode);
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
    props: PassthroughProps<P> & {value: FieldValue; error?: string}
  ) => React.ReactNode;
  /**
   * Extra styles to apply to the field
   */
  style?: React.CSSProperties;
  /**
   * Transform input when a value is set to the model.
   */
  transformInput?: (value: any) => any; // used in prettyFormString
};

type Props<P> = BaseProps<P> & ObservableProps<P> & Omit<Field['props'], PropToObserve>;

/**
 * ResolvedProps do NOT include props which may be given functions that are
 * reacted on. Resolved props are used inside of makeField.
 */
type ResolvedProps<P> = BaseProps<P> & Field['props'];

type PassthroughProps<P> = Omit<
  ResolvedProps<P>,
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

class FormField<P extends {} = {}> extends React.Component<Props<P>> {
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
   * The ref must be forwared for this to work.
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
      const props = {...otherProps, ...resolvedObservedProps} as PassthroughProps<P>;

      return (
        <React.Fragment>
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
                    const showReturnButton = model.getFieldState(
                      name,
                      'showReturnButton'
                    );

                    return (
                      <React.Fragment>
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
                        })}
                        {showReturnButton && <StyledReturnButton />}
                      </React.Fragment>
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
                    ? props.visible({...this.props, ...props} as ResolvedProps<P>)
                    : true;

                return (
                  <React.Fragment>
                    {isVisible ? selectionInfoFunction({...props, error, value}) : null}
                  </React.Fragment>
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
                  <PanelAlert type={saveMessageAlertType}>
                    <MessageAndActions>
                      <div>
                        {typeof saveMessage === 'function'
                          ? saveMessage({...props, value})
                          : saveMessage}
                      </div>
                      <ButtonBar gap={1}>
                        <Button onClick={this.handleCancelField}>{t('Cancel')}</Button>
                        <Button
                          priority="primary"
                          type="button"
                          onClick={this.handleSaveField}
                        >
                          {t('Save')}
                        </Button>
                      </ButtonBar>
                    </MessageAndActions>
                  </PanelAlert>
                );
              }}
            </Observer>
          )}
        </React.Fragment>
      );
    };

    type ObservedPropResolver = [
      PropToObserve,
      () => ResolvedObservableProps[PropToObserve]
    ];

    const observedProps = propsToObserver
      .filter(p => typeof this.props[p] === 'function')
      .map<ObservedPropResolver>(p => [
        p,
        () => (this.props[p] as ObservedFn<P, any>)({...this.props, model}),
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

const MessageAndActions = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(2)};
  align-items: flex-start;
`;

const StyledReturnButton = styled(ReturnButton)`
  position: absolute;
  right: 0;
  top: 0;
`;
