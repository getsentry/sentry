import PropTypes from 'prop-types';
import React from 'react';
import DocumentTitle from 'react-document-title';

import AsyncView from 'app/views/asyncView';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import {ApiForm} from 'app/components/forms';
import {getOptionField, getForm} from 'app/options';

export default class InstallWizard extends AsyncView {
  static propTypes = {
    onConfigured: PropTypes.func.isRequired,
  };

  componentWillMount() {
    super.componentWillMount();
    jQuery(document.body).addClass('install-wizard');
  }

  componentWillUnmount() {
    super.componentWillUnmount();
    jQuery(document.body).removeClass('install-wizard');
  }

  getEndpoint() {
    return '/internal/options/?query=is:required';
  }

  renderFormFields() {
    let options = this.state.data;
    let missingOptions = new Set(
      Object.keys(options).filter(option => !options[option].field.isSet)
    );
    // This is to handle the initial installation case.
    // Even if all options are filled out, we want to prompt to confirm
    // them. This is a bit of a hack because we're assuming that
    // the backend only spit back all filled out options for
    // this case.
    if (missingOptions.size === 0) {
      missingOptions = new Set(Object.keys(options));
    }

    // A mapping of option name to Field object
    let fields = {};

    for (let key of missingOptions) {
      let option = options[key];
      if (option.field.disabled) {
        continue;
      }
      fields[key] = getOptionField(key, option.field);
    }

    return getForm(fields);
  }

  getInitialData() {
    let options = this.state.data;
    let data = {};
    Object.keys(options).forEach(optionName => {
      let option = options[optionName];
      if (!option.field.isSet) {
        data[optionName] = option.value;
      }
    });
    return data;
  }

  getTitle() {
    return t('Setup Sentry');
  }

  render() {
    let version = ConfigStore.get('version');
    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          <div className="pattern" />
          <div className="setup-wizard">
            <h1>
              <span>{t('Welcome to Sentry')}</span>
              <small>{version.current}</small>
            </h1>
            {this.state.loading
              ? this.renderLoading()
              : this.state.error
                ? this.renderError(new Error('Unable to load all required endpoints'))
                : this.renderBody()}
          </div>
        </div>
      </DocumentTitle>
    );
  }

  renderError() {
    return (
      <div className="loading-error">
        <span className="icon-exclamation" />
        {t(
          'We were unable to load the required configuration from the Sentry server. Please take a look at the service logs.'
        )}
      </div>
    );
  }

  renderBody() {
    return (
      <ApiForm
        apiMethod="PUT"
        apiEndpoint={this.getEndpoint()}
        submitLabel={t('Continue')}
        initialData={this.getInitialData()}
        onSubmitSuccess={this.props.onConfigured}
      >
        <p>{t('Complete setup by filling out the required configuration.')}</p>

        {this.renderFormFields()}
      </ApiForm>
    );
  }
}
