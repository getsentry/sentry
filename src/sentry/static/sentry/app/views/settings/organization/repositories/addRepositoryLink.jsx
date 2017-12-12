import Modal from 'react-bootstrap/lib/Modal';
import PropTypes from 'prop-types';
import React from 'react';

import {FormState} from '../../../../components/forms';
import {parseRepo} from '../../../../utils';
import {t, tct} from '../../../../locale';
import PluginComponentBase from '../../../../components/bases/pluginComponentBase';

const UNKNOWN_ERROR = {
  error_type: 'unknown',
};

class AddRepositoryLink extends PluginComponentBase {
  static propTypes = {
    provider: PropTypes.object.isRequired,
  };

  constructor(props, context) {
    super(props, context);

    Object.assign(this.state, {
      ...this.getDefaultState(),
      fieldList: null,
      loading: true,
      state: FormState.LOADING,
    });

    ['onOpen', 'onCancel', 'formSubmit', 'changeField'].forEach(method => {
      this[method] = this[method].bind(this);
    });
  }

  getDefaultState() {
    return {
      isModalOpen: false,
      error: {},
      formData: {},
    };
  }

  onOpen() {
    this.setState({isModalOpen: true});
  }

  onCancel() {
    this.setState(this.getDefaultState());
  }

  formSubmit(ev) {
    // since this doesn't use the Form component, wrap onSubmit
    // in a function that calls preventDefault
    ev.preventDefault();
    this.onSubmit();
  }

  onSubmit() {
    // TODO(dcramer): set form saving state
    let formData = {
      ...this.state.formData,
      provider: this.props.provider.id,
    };
    if (formData.name) {
      formData.name = parseRepo(formData.name);
    }

    this.setState(
      {
        state: FormState.SAVING,
      },
      () => {
        this.api.request(`/organizations/${this.props.orgId}/repos/`, {
          data: formData,
          method: 'POST',
          success: this.onSaveSuccess.bind(this, data => {
            this.setState({isModalOpen: false, formData: {}, error: {}});
            this.props.onSuccess(data);
          }),
          error: this.onSaveError.bind(this, error => {
            this.setState({
              error: error.responseJSON || UNKNOWN_ERROR || UNKNOWN_ERROR,
              state: FormState.error,
            });
          }),
          complete: this.onSaveComplete,
        });
      }
    );
  }

  changeField(name, value) {
    this.setState(state => ({
      formData: {
        ...state.formData,
        [name]: value,
      },
    }));
  }

  renderForm() {
    let errors = this.state.error.errors || {};
    let provider = this.props.provider;
    return (
      <form onSubmit={this.formSubmit}>
        {errors.__all__ && (
          <div className="alert alert-error alert-block" key="_errors">
            <p>{errors.__all__}</p>
          </div>
        )}
        {provider.config.map(field => {
          return (
            <div key={field.name}>
              {this.renderField({
                config: field,
                formData: this.state.formData,
                formErrors: errors,
                onChange: this.changeField.bind(this, field.name),
              })}
            </div>
          );
        })}
      </form>
    );
  }

  renderBody() {
    let error = this.state.error;
    if (error.error_type === 'auth') {
      let authUrl = error.auth_url;
      if (authUrl.indexOf('?') === -1) {
        authUrl += '?next=' + encodeURIComponent(document.location.pathname);
      } else {
        authUrl += '&next=' + encodeURIComponent(document.location.pathname);
      }
      return (
        <div>
          <div className="alert alert-warning m-b-1">
            {'You need to associate an identity with ' +
              this.props.provider.name +
              ' before you can create issues with this service.'}
          </div>
          <a className="btn btn-primary" href={authUrl}>
            Associate Identity
          </a>
        </div>
      );
    } else if (error.error_type && error.error_type !== 'validation') {
      return (
        <div className="alert alert-error alert-block">
          <p>
            {error.message
              ? error.message
              : tct(
                  'An unknown error occurred. Need help with this? [link:Contact support]',
                  {
                    link: <a href="https://sentry.io/support/" />,
                  }
                )}
          </p>
        </div>
      );
    }
    return this.renderForm();
  }

  renderModal() {
    let {error, state} = this.state;
    return (
      <Modal show={this.state.isModalOpen} animation={false}>
        <div className="modal-header">
          <h4>{t('Add Repository')}</h4>
        </div>
        <div className="modal-body">{this.renderBody()}</div>
        {!error || error.error_type !== 'unknown' || error.message ? (
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-default"
              onClick={this.onCancel}
              disabled={state === FormState.SAVING}
            >
              {t('Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={this.onSubmit}
              disabled={state === FormState.SAVING}
            >
              {t('Save Changes')}
            </button>
          </div>
        ) : null}
      </Modal>
    );
  }

  render() {
    let provider = this.props.provider;
    return (
      <a onClick={this.onOpen}>
        {provider.name}
        {this.renderModal()}
      </a>
    );
  }
}
export default AddRepositoryLink;
