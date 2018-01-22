import {Box, Flex} from 'grid-emotion';
import {Observer} from 'mobx-react';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import styled from 'react-emotion';

import {defined} from '../../../../../utils';
import {pulse, fadeOut} from '../styled/animations';
import FormFieldControl from './formFieldControl';
import FormFieldControlState from './formFieldControlState';
import FormFieldDescription from './formFieldDescription';
import FormFieldHelp from './formFieldHelp';
import FormFieldLabel from './formFieldLabel';
import FormFieldRequiredBadge from './formFieldRequiredBadge';
import FormFieldWrapper from './formFieldWrapper';
import FormState from '../../../../../components/forms/state';
import InlineSvg from '../../../../../components/inlineSvg';
import Spinner from '../styled/spinner';

// This wraps Control + ControlError message
// * can NOT be a flex box have because of position: absolute on "control error message"
// * can NOT have overflow hidden because "control error message" overflows
const FormFieldControlErrorWrapper = styled(({inline, ...props}) => <Box {...props} />)`
  ${p => (p.inline ? 'width: 50%; padding-left: 10px;' : '')};
`;

const FormFieldControlStyled = styled(({alignRight, ...props}) => (
  <FormFieldControl {...props} />
))`
  display: flex;
  flex-direction: column;
  ${p => (p.alignRight ? 'align-items: flex-end;' : '')};
`;

const FormFieldControlWrapper = styled(Flex)``;

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

class FormField extends React.Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    /** Inline style */
    style: PropTypes.object,

    label: PropTypes.string,
    defaultValue: PropTypes.any,
    disabled: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
    disabledReason: PropTypes.string,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    required: PropTypes.bool,
    hideErrorMessage: PropTypes.bool,
    highlighted: PropTypes.bool,
    alignRight: PropTypes.bool,

    /**
     * Should control be inline with field label
     */
    inline: PropTypes.bool,

    // the following should only be used without form context
    onChange: PropTypes.func,
    onBlur: PropTypes.func,
    onKeyDown: PropTypes.func,
    onMouseOver: PropTypes.func,
    onMouseOut: PropTypes.func,
    error: PropTypes.string,
    value: PropTypes.any,
  };

  static defaultProps = {
    hideErrorMessage: false,
    inline: true,
    disabled: false,
    required: false,
  };

  static contextTypes = {
    location: PropTypes.object,
    form: PropTypes.object,
  };

  componentDidMount() {
    // this.attachTooltips();
    // Tell model about this field's props
    this.getModel().setFieldDescriptor(this.props.name, this.props);
  }

  componentWillUnmount() {
    //this.removeTooltips();
    jQuery(ReactDOM.findDOMNode(this)).unbind();
  }

  attachTooltips() {
    jQuery('.tip', ReactDOM.findDOMNode(this)).tooltip();
  }

  removeTooltips() {
    jQuery('.tip', ReactDOM.findDOMNode(this)).tooltip('destroy');
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
  handleInputMount = ref => {
    if (ref && !this.input) {
      let hash = this.context.location.hash;

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
    let {
      highlighted,
      required,
      label,
      inline,
      disabled,
      disabledReason,
      hideErrorMessage,
      help,
      alignRight,
    } = this.props;
    let id = this.getId();
    let model = this.getModel();
    let isDisabled = typeof disabled === 'function' ? disabled(this.props) : disabled;

    return (
      <FormFieldWrapper inline={inline} highlighted={highlighted}>
        <FormFieldDescription inline={inline} htmlFor={id}>
          {label && (
            <FormFieldLabel>
              {label} {required && <FormFieldRequiredBadge />}
            </FormFieldLabel>
          )}
          {help && <FormFieldHelp>{help}</FormFieldHelp>}
        </FormFieldDescription>

        <FormFieldControlErrorWrapper inline={inline}>
          <FormFieldControlWrapper shrink="0">
            <FormFieldControlStyled flex="1" alignRight={alignRight}>
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
                        value,
                        error,
                        disabled: isDisabled,
                      }}
                      initialData={model.initialData}
                    />
                  );
                }}
              </Observer>

              {isDisabled &&
                disabledReason && (
                  <span className="disabled-indicator tip" title={disabledReason}>
                    <span className="icon-question" />
                  </span>
                )}
            </FormFieldControlStyled>

            <FormFieldControlState justify="center" align="center">
              <Observer>
                {() => {
                  let isSaving = model.getFieldState(this.props.name, FormState.SAVING);
                  let isSaved = model.getFieldState(this.props.name, FormState.READY);

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
                  let error = this.getError();

                  if (!error) return null;

                  return (
                    <FormFieldError>
                      <InlineSvg src="icon-warning-sm" size="18px" />
                    </FormFieldError>
                  );
                }}
              </Observer>
            </FormFieldControlState>
          </FormFieldControlWrapper>

          <Observer>
            {() => {
              let error = this.getError();
              let shouldShowErrorMessage = error && !hideErrorMessage;
              if (!shouldShowErrorMessage) return null;
              return <FormFieldErrorReason>{error}</FormFieldErrorReason>;
            }}
          </Observer>
        </FormFieldControlErrorWrapper>
      </FormFieldWrapper>
    );
  }
}

export default FormField;
