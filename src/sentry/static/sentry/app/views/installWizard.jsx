import PropTypes from 'prop-types';
import React from 'react';
import DocumentTitle from 'react-document-title';

import AsyncView from 'app/views/asyncView';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import {ApiForm} from 'app/components/forms';
import {getOptionDefault, getOptionField, getForm} from 'app/options';

export default class InstallWizard extends AsyncView {
  static propTypes = {
    onConfigured: PropTypes.func.isRequired,
  };

  UNSAFE_componentWillMount() {
    super.UNSAFE_componentWillMount();
    document.body.classList.add('install-wizard');
  }

  componentWillUnmount() {
    super.componentWillUnmount();
    document.body.classList.remove('install-wizard');
  }

  getEndpoints() {
    return [['data', '/internal/options/?query=is:required']];
  }

  renderFormFields() {
    const options = this.state.data;

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
    const fields = {};

    for (const key of missingOptions) {
      const option = options[key];
      if (option.field.disabled) {
        continue;
      }
      fields[key] = getOptionField(key, option.field);
    }

    return getForm(fields);
  }

  getInitialData() {
    const options = this.state.data;
    const data = {};
    Object.keys(options).forEach(optionName => {
      const option = options[optionName];
      if (option.field.disabled) {
        return;
      }

      // TODO(dcramer): we need to rethink this logic as doing multiple "is this value actually set"
      // is problematic
      // all values to their server-defaults (as client-side defaults dont really work)
      const displayValue = option.value || getOptionDefault(optionName);
      if (
        // XXX(dcramer): we need the user to explicitly choose beacon.anonymous
        // vs using an implied default so effectively this is binding
        optionName !== 'beacon.anonymous' &&
        // XXX(byk): if we don't have a set value but have a default value filled
        // instead, from the client, set it on the data so it is sent to the server
        !option.field.isSet &&
        displayValue !== undefined
      ) {
        data[optionName] = displayValue;
      }
    });
    return data;
  }

  getTitle() {
    return t('Setup Sentry');
  }

  render() {
    const version = ConfigStore.get('version');
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
        apiEndpoint={this.getEndpoints()[0][1]}
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
