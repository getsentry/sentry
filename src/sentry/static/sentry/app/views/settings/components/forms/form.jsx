import {Observer} from 'mobx-react';
import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import FormModel from 'app/views/settings/components/forms/model';

export default class Form extends React.Component {
  static propTypes = {
    cancelLabel: PropTypes.string,
    onCancel: PropTypes.func,
    onSubmit: PropTypes.func,
    onSubmitSuccess: PropTypes.func,
    onSubmitError: PropTypes.func,
    onFieldChange: PropTypes.func,
    submitDisabled: PropTypes.bool,
    submitLabel: PropTypes.string,
    submitPriority: PropTypes.string,
    footerClass: PropTypes.string,
    footerStyle: PropTypes.object,
    extraButton: PropTypes.element,
    initialData: PropTypes.object,
    // Require changes before able to submit form
    requireChanges: PropTypes.bool,
    // Reset form when there are errors, after submit
    resetOnError: PropTypes.bool,
    // Hide Footer
    hideFooter: PropTypes.bool,
    // Allow undo
    allowUndo: PropTypes.bool,
    // Save field on control blur
    saveOnBlur: PropTypes.bool,
    model: PropTypes.object,
    apiMethod: PropTypes.string,
    apiEndpoint: PropTypes.string,
    'data-test-id': PropTypes.string,
  };

  static defaultProps = {
    cancelLabel: t('Cancel'),
    submitLabel: t('Save Changes'),
    submitDisabled: false,
    submitPriority: 'primary',
    footerClass: 'form-actions align-right',
    className: 'form-stacked',
    requireChanges: false,
    allowUndo: false,
    saveOnBlur: false,
    onSubmitSuccess: () => {},
    onSubmitError: () => {},
  };

  static childContextTypes = {
    saveOnBlur: PropTypes.bool.isRequired,
    form: PropTypes.object.isRequired,
  };

  constructor(props, context) {
    super(props, context);
    let {
      saveOnBlur,
      apiEndpoint,
      apiMethod,
      resetOnError,
      onSubmitSuccess,
      onSubmitError,
      onFieldChange,
      initialData,
      model,
      allowUndo,
    } = props;

    this.model = model || new FormModel();
    this.model.setInitialData(initialData);
    this.model.setFormOptions({
      resetOnError,
      allowUndo,
      onFieldChange,
      onSubmitSuccess,
      onSubmitError,
      saveOnBlur,
      apiEndpoint,
      apiMethod,
    });
  }

  getChildContext() {
    return {
      saveOnBlur: this.props.saveOnBlur,
      form: this.model,
    };
  }

  componentWillUnmount() {
    this.model.reset();
    this.model = null;
  }

  onSubmit = e => {
    e.preventDefault();
    if (this.model.isSaving) {
      return;
    }

    if (this.props.onSubmit) {
      this.props.onSubmit(
        this.model.getData(),
        this.onSubmitSuccess,
        this.onSubmitError,
        e
      );
    } else {
      this.model.saveForm();
    }
  };

  onSubmitSuccess = data => {
    this.model.submitSuccess(data);
    this.props.onSubmitSuccess(data, this.model);
  };

  onSubmitError = error => {
    this.model.submitError(error);
    this.props.onSubmitError(error, this.model);
  };

  render() {
    let {isSaving} = this.model;
    let {
      className,
      children,
      footerClass,
      footerStyle,
      submitDisabled,
      submitLabel,
      submitPriority,
      cancelLabel,
      onCancel,
      extraButton,
      requireChanges,
      saveOnBlur,
      hideFooter,
    } = this.props;
    let shouldShowFooter = typeof hideFooter !== 'undefined' ? !hideFooter : !saveOnBlur;

    return (
      <form
        onSubmit={this.onSubmit}
        className={className}
        data-test-id={this.props['data-test-id']}
      >
        <div>{children}</div>

        {shouldShowFooter && (
          <div className={footerClass} style={{marginTop: 25, ...footerStyle}}>
            <Observer>
              {() => (
                <Button
                  data-test-id="form-submit"
                  priority={submitPriority}
                  disabled={
                    this.model.isError ||
                    isSaving ||
                    submitDisabled ||
                    (requireChanges ? !this.model.formChanged : false)
                  }
                  type="submit"
                >
                  {submitLabel}
                </Button>
              )}
            </Observer>

            {onCancel && (
              <Button disabled={isSaving} onClick={onCancel} style={{marginLeft: 5}}>
                {cancelLabel}
              </Button>
            )}
            {extraButton}
          </div>
        )}
      </form>
    );
  }
}
