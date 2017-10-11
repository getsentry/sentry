import {Observer} from 'mobx-react';
import PropTypes from 'prop-types';
import React from 'react';

import {t} from '../../../locale';
import Button from '../../buttons/button';
import FormModel from './model';

export default class Form extends React.Component {
  static propTypes = {
    cancelLabel: PropTypes.string,
    onCancel: PropTypes.func,
    onSubmit: PropTypes.func,
    onSubmitSuccess: PropTypes.func,
    onSubmitError: PropTypes.func,
    submitDisabled: PropTypes.bool,
    submitLabel: PropTypes.string,
    footerClass: PropTypes.string,
    extraButton: PropTypes.element,
    initialData: PropTypes.object,
    requireChanges: PropTypes.bool,
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
      initialData,
      model,
    } = props;

    this.model = model || new FormModel();
    this.model.setInitialData(initialData);
    this.model.setFormOptions({
      onSubmitSuccess,
      onSubmitError,
      saveOnBlur,
      apiEndpoint,
      apiMethod,
    });

    window.test = this.model;
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

    this.props.onSubmit(this.model.getData(), this.onSubmitSuccess, this.onSubmitError);
  };

  onSubmitSuccess = data => {
    this.model.submitSuccess(data);
    this.props.onSubmitSuccess && this.props.onSubmitSuccess(data, this.model);
  };

  onSubmitError = error => {
    this.model.submitError(error);
    this.props.onSubmitError && this.props.onSubmitError(error, this.model);
  };

  render() {
    let {isSaving} = this.model;
    let {
      className,
      children,
      footerClass,
      submitDisabled,
      submitLabel,
      cancelLabel,
      onCancel,
      extraButton,
      requireChanges,
      saveOnBlur,
    } = this.props;
    let shouldShowFooter = !saveOnBlur;

    return (
      <form onSubmit={this.onSubmit} className={className}>
        {children}

        {shouldShowFooter && (
          <div className={footerClass} style={{marginTop: 25}}>
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
