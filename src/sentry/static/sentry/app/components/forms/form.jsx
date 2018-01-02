import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';

import FormState from './state';
import {t} from '../../locale';

export default class Form extends React.Component {
  static propTypes = {
    cancelLabel: PropTypes.string,
    onCancel: PropTypes.func,
    onSubmit: PropTypes.func.isRequired,
    onSubmitSuccess: PropTypes.func,
    onSubmitError: PropTypes.func,
    submitDisabled: PropTypes.bool,
    submitLabel: PropTypes.string,
    footerClass: PropTypes.string,
    extraButton: PropTypes.element,
    initialData: PropTypes.object,
    requireChanges: PropTypes.bool,
    errorMessage: PropTypes.node,
    hideErrors: PropTypes.bool,
    resetOnError: PropTypes.bool,
  };

  static defaultProps = {
    cancelLabel: t('Cancel'),
    submitLabel: t('Save Changes'),
    submitDisabled: false,
    footerClass: 'form-actions align-right',
    className: 'form-stacked',
    requireChanges: false,
    hideErrors: false,
    resetOnError: false,
    errorMessage: t(
      'Unable to save your changes. Please ensure all fields are valid and try again.'
    ),
  };

  static childContextTypes = {
    form: PropTypes.object.isRequired,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      data: {...this.props.initialData},
      errors: {},
      initialData: {...this.props.initialData},
      state: FormState.READY,
    };
  }

  getChildContext() {
    let {data, errors} = this.state;
    return {
      form: {
        data,
        errors,
        onFieldChange: this.onFieldChange,
      },
    };
  }

  onSubmit = e => {
    e.preventDefault();
    this.props.onSubmit(this.state.data, this.onSubmitSuccess, this.onSubmitError);
  };

  onSubmitSuccess = data => {
    let curData = this.state.data;
    let newData = {};
    Object.keys(curData).forEach(k => {
      if (data.hasOwnProperty(k)) newData[k] = data[k];
      else newData[k] = curData[k];
    });

    this.setState({
      state: FormState.READY,
      errors: {},
      initialData: newData,
    });
    this.props.onSubmitSuccess && this.props.onSubmitSuccess(data);
  };

  onSubmitError = error => {
    this.setState({
      state: FormState.ERROR,
      errors: error.responseJSON,
    });

    if (this.props.resetOnError) {
      this.setState({
        initialData: {},
      });
    }

    this.props.onSubmitError && this.props.onSubmitError(error);
  };

  onFieldChange = (name, value) => {
    this.setState(state => ({
      data: {
        ...state.data,
        [name]: value,
      },
    }));
  };

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let {initialData, data} = this.state;
    let {errorMessage, hideErrors, requireChanges} = this.props;
    let hasChanges = requireChanges
      ? Object.keys(data).length && !_.isEqual(data, initialData)
      : true;
    let isError = this.state.state == FormState.ERROR;
    let nonFieldErrors = this.state.errors && this.state.errors.non_field_errors;

    return (
      <form onSubmit={this.onSubmit} className={this.props.className}>
        {isError &&
          !hideErrors && (
            <div className="alert alert-error alert-block">
              {nonFieldErrors ? (
                <div>
                  <p>
                    {t(
                      'Unable to save your changes. Please correct the following errors try again.'
                    )}
                  </p>
                  <ul>{nonFieldErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              ) : (
                errorMessage
              )}
            </div>
          )}
        {this.props.children}
        <div className={this.props.footerClass} style={{marginTop: 25}}>
          <button
            className="btn btn-primary"
            disabled={isSaving || this.props.submitDisabled || !hasChanges}
            type="submit"
          >
            {this.props.submitLabel}
          </button>
          {this.props.onCancel && (
            <button
              type="button"
              className="btn btn-default"
              disabled={isSaving}
              onClick={this.props.onCancel}
              style={{marginLeft: 5}}
            >
              {this.props.cancelLabel}
            </button>
          )}
          {this.props.extraButton}
        </div>
      </form>
    );
  }
}
