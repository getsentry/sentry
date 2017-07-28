import React from 'react';
import _ from 'lodash';

import FormState from './state';
import {t} from '../../locale';

export default class Form extends React.Component {
  static propTypes = {
    cancelLabel: React.PropTypes.string,
    onCancel: React.PropTypes.func,
    onSubmit: React.PropTypes.func.isRequired,
    onSubmitSuccess: React.PropTypes.func,
    onSubmitError: React.PropTypes.func,
    submitDisabled: React.PropTypes.bool,
    submitLabel: React.PropTypes.string,
    footerClass: React.PropTypes.string,
    extraButton: React.PropTypes.element,
    initialData: React.PropTypes.object,
    requireChanges: React.PropTypes.bool
  };

  static defaultProps = {
    cancelLabel: t('Cancel'),
    submitLabel: t('Save Changes'),
    submitDisabled: false,
    footerClass: 'form-actions align-right',
    className: 'form-stacked',
    requireChanges: false
  };

  static childContextTypes = {
    form: React.PropTypes.object.isRequired
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      data: {...this.props.initialData},
      errors: {},
      initialData: {...this.props.initialData},
      state: FormState.READY
    };
  }

  getChildContext() {
    let {data, errors} = this.state;
    return {
      form: {
        data,
        errors,
        onFieldChange: this.onFieldChange
      }
    };
  }

  onSubmit = e => {
    e.preventDefault();
    this.props.onSubmit(this.state.data, this.onSubmitSuccess, this.onSubmitError);
  };

  onSubmitSuccess = data => {
    let curData = this.state.data;
    let newData = {};
    Object.keys(data).forEach(k => {
      if (curData.hasOwnProperty(k)) newData[k] = data[k];
    });

    this.setState({
      state: FormState.READY,
      errors: {},
      initialData: newData
    });
    this.props.onSubmitSuccess && this.props.onSubmitSuccess(data);
  };

  onSubmitError = error => {
    this.setState({
      state: FormState.ERROR,
      errors: error.responseJSON
    });
    this.props.onSubmitError && this.props.onSubmitError(error);
  };

  onFieldChange = (name, value) => {
    this.setState({
      data: {
        ...this.state.data,
        [name]: value
      }
    });
  };

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let {initialData, data} = this.state;
    let {requireChanges} = this.props;
    let hasChanges = requireChanges
      ? Object.keys(data).length && !_.isEqual(data, initialData)
      : true;
    return (
      <form onSubmit={this.onSubmit} className={this.props.className}>
        {this.state.state === FormState.ERROR &&
          <div className="alert alert-error alert-block">
            {t(
              'Unable to save your changes. Please ensure all fields are valid and try again.'
            )}
          </div>}
        {this.props.children}
        <div className={this.props.footerClass} style={{marginTop: 25}}>
          <button
            className="btn btn-primary"
            disabled={isSaving || this.props.submitDisabled || !hasChanges}
            type="submit">
            {this.props.submitLabel}
          </button>
          {this.props.onCancel &&
            <button
              className="btn btn-default"
              disabled={isSaving}
              onClick={this.props.onCancel}
              style={{marginLeft: 5}}>
              {this.props.cancelLabel}
            </button>}
          {this.props.extraButton}
        </div>
      </form>
    );
  }
}
