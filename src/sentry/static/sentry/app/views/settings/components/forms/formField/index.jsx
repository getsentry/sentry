import {Observer} from 'mobx-react';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {defined} from '../../../../../utils';
import {pulse, fadeOut} from '../../../../../styles/animations';
import Field from '../field';
import FieldControl from '../field/fieldControl';
import FormState from '../../../../../components/forms/state';
import InlineSvg from '../../../../../components/inlineSvg';
import Spinner from '../spinner';
import returnButton from '../returnButton';

const FormFieldErrorReason = styled.div`
  color: ${p => p.theme.redDark};
  position: absolute;
  background: #fff;
  padding: 6px 8px;
  font-weight: 600;
  font-size: 12px;
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba(64, 11, 54, 0.15), 0 4px 20px 0 rgba(64, 11, 54, 0.36);
  z-index: 10000;
`;

const FormFieldError = styled.div`
  color: ${p => p.theme.redDark};
  animation: ${pulse} 1s ease infinite;
`;

const FormFieldIsSaved = styled.div`
  color: ${p => p.theme.green};
  animation: ${fadeOut} 0.3s ease 2s 1 forwards;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const FormSpinner = styled(Spinner)`
  margin-left: 0;
`;

const ReturnButtonStyled = styled(returnButton)`
  position: absolute;
  right: 0;
  top: 0;
`;

/**
 * Some fields don't need to implement their own onChange handlers, in
 * which case we will receive an Event, but if they do we should handle
 * the case where they return a value as the first argument.
 */
const getValueFromEvent = (valueOrEvent, e) => {
  let event = e || valueOrEvent;
  let value = defined(e) ? valueOrEvent : event && event.target && event.target.value;

  return {
    value,
    event,
  };
};

/**
 * ControlState (i.e. loading/error icons) for connected form components
 */
class ControlState extends React.Component {
  static propTypes = {
    model: PropTypes.object,
    name: PropTypes.string,
  };

  render() {
    let {model, name} = this.props;

    return (
      <React.Fragment>
        <Observer>
          {() => {
            let isSaving = model.getFieldState(name, FormState.SAVING);
            let isSaved = model.getFieldState(name, FormState.READY);

            if (isSaving) {
              return <FormSpinner />;
            } else if (isSaved) {
              return (
                <FormFieldIsSaved>
                  <InlineSvg src="icon-checkmark-sm" size="18px" />
                </FormFieldIsSaved>
              );
            }

            return null;
          }}
        </Observer>

        <Observer>
          {() => {
            let error = model.getError(name);

            if (!error) return null;

            return (
              <FormFieldError>
                <InlineSvg src="icon-warning-sm" size="18px" />
              </FormFieldError>
            );
          }}
        </Observer>
      </React.Fragment>
    );
  }
}

class FormField extends React.Component {
  static propTypes = {
    name: PropTypes.string.isRequired,

    /** Inline style */
    style: PropTypes.object,

    /**
     * Should show a "return key" icon in input?
     */
    showReturnButton: PropTypes.bool,

    /**
     * Should hide error message?
     */
    hideErrorMessage: PropTypes.bool,

    // the following should only be used without form context
    onChange: PropTypes.func,
    onBlur: PropTypes.func,
    onKeyDown: PropTypes.func,
    onMouseOver: PropTypes.func,
    onMouseOut: PropTypes.func,
  };

  static defaultProps = {
    hideErrorMessage: false,
  };

  static contextTypes = {
    location: PropTypes.object,
    form: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {showReturnButton: false};
  }

  componentDidMount() {
    // Tell model about this field's props
    this.getModel().setFieldDescriptor(this.props.name, this.props);
  }

  getError(props, context) {
    return this.getModel().getError(this.props.name);
  }

  getId() {
    return this.props.name;
  }

  getModel() {
    return this.context.form;
  }

  // Only works for styled inputs
  // Attempts to autofocus input field if field's name is in url hash
  handleInputMount = ref => {
    if (ref && !this.input) {
      let hash = this.context.location && this.context.location.hash;

      if (!hash) return;

      if (hash !== `#${this.props.name}`) return;

      ref.focus();
    }

    this.input = ref;
  };

  /**
   * Update field value in form model
   */
  handleChange = (...args) => {
    let {name, onChange} = this.props;
    let {value, event} = getValueFromEvent(...args);
    let model = this.getModel();

    if (this.props.showReturnButton) this.setState({showReturnButton: true});

    if (onChange) {
      onChange(value, event);
    }

    model.setValue(name, value);
  };

  /**
   * Notify model of a field being blurred
   */
  handleBlur = (...args) => {
    let {name, onBlur} = this.props;
    let {value, event} = getValueFromEvent(...args);
    let model = this.getModel();

    if (onBlur) {
      onBlur(value, event);
    }

    // Always call this, so model can decide what to do
    model.handleFieldBlur(name, value);
  };

  /**
   * Handle keydown to trigger a save on Enter
   */
  handleKeyDown = (...args) => {
    let {onKeyDown, name} = this.props;
    let {value, event} = getValueFromEvent(...args);
    let model = this.getModel();

    if (event.key === 'Enter') {
      model.handleFieldBlur(name, value);
    }

    if (onKeyDown) {
      onKeyDown(value, event);
    }
  };

  render() {
    let {name, showReturnButton, hideErrorMessage, ...props} = this.props;
    let id = this.getId();
    let model = this.getModel();

    return (
      <Field id={id} name={name} {...props}>
        {({alignRight, inline, disabled, disabledReason}) => (
          <FieldControl
            disabled={disabled}
            disabledReason={disabledReason}
            inline={inline}
            alignRight={alignRight}
            controlState={<ControlState model={model} name={name} />}
            errorState={
              <Observer>
                {() => {
                  let error = this.getError();
                  let shouldShowErrorMessage = error && !hideErrorMessage;
                  if (!shouldShowErrorMessage) return null;
                  return <FormFieldErrorReason>{error}</FormFieldErrorReason>;
                }}
              </Observer>
            }
          >
            <Observer>
              {() => {
                let error = this.getError();
                let value = model.getValue(this.props.name);

                return (
                  <this.props.children
                    innerRef={this.handleInputMount}
                    {...{
                      ...this.props,
                      id,
                      onKeyDown: this.handleKeyDown,
                      onChange: this.handleChange,
                      onBlur: this.handleBlur,
                      // Fixes react warnings about input switching from controlled to uncontrolled
                      // So force to empty string for null values
                      value: value === null ? '' : value,
                      error,
                      disabled,
                    }}
                    initialData={model.initialData}
                  />
                );
              }}
            </Observer>

            {showReturnButton && this.state.showReturnButton && <ReturnButtonStyled />}
          </FieldControl>
        )}
      </Field>
    );
  }
}

export default FormField;
