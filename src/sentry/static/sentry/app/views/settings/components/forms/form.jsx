import {Observer} from 'mobx-react';
import PropTypes from 'prop-types';
import React from 'react';

import {t} from '../../../../locale';
import Button from '../../../../components/buttons/button';
import FormModel from './model';

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
    footerClass: PropTypes.string,
    footerStyle: PropTypes.object,
    extraButton: PropTypes.element,
    initialData: PropTypes.object,
    requireChanges: PropTypes.bool,
    hideFooter: PropTypes.bool,
    model: PropTypes.object,
    allowUndo: PropTypes.bool,
    saveOnBlur: PropTypes.bool,
    apiMethod: PropTypes.string,
    apiEndpoint: PropTypes.string,
  };

  static defaultProps = {
    cancelLabel: t('Cancel'),
    submitLabel: t('Save Changes'),
    submitDisabled: false,
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
      this.props.onSubmit(this.model.getData(), this.onSubmitSuccess, this.onSubmitError);
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
      cancelLabel,
      onCancel,
      extraButton,
      requireChanges,
      saveOnBlur,
      hideFooter,
    } = this.props;
    let shouldShowFooter = typeof hideFooter !== 'undefined' ? !hideFooter : !saveOnBlur;

    return (
      <form onSubmit={this.onSubmit} className={className}>
        {children}

        {shouldShowFooter && (
          <div className={footerClass} style={{marginTop: 25, ...footerStyle}}>
            <Observer>
              {() => (
                <Button
                  priority="primary"
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
