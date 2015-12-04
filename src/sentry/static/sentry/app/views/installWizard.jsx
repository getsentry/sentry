import React from 'react';
import DocumentTitle from 'react-document-title';

import {t} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import ConfigStore from '../stores/configStore';
import LoadingIndicator from '../components/loadingIndicator';
import {EmailField, TextField} from '../components/forms';

const InstallWizardSettings = React.createClass({
  getDefaultRootUrl() {
    return `${document.location.protocol}//${document.location.host}`;
  },

  onFieldChange(name, value) {
    this.setState({[name]: value});
  },

  render() {
    let options = this.props.options;
    let requiredOptions = ['system.url-prefix', 'system.admin-email'];
    let missingOptions = new Set(requiredOptions.filter(option => !options[option]));
    let formValid = !missingOptions.length;

    return (
      <div>
        <p>Welcome to Sentry, yo! Complete setup by filling out the required
          configuration.</p>

        {missingOptions.has('system.url-prefix') &&
          <TextField label={t('Root URL')} defaultValue={this.getDefaultRootUrl()}
              placeholder="https://sentry.example.com"
              help={t('The root web address which is used to communication with the Sentry backend.')}
              onChange={this.onFieldChange.bind(this, 'system.url-prefix')} />
        }

        {missingOptions.has('system.admin-email') &&
          <EmailField label={t('Admin Email')}
              placeholder="admin@example.com"
              help={t('The technical contact for this Sentry installation.')}
              onChange={this.onFieldChange.bind(this, 'system.admin-email')} />
        }

        <div className="form-actions" style={{marginTop: 25}}>
          <button className="btn btn-primary"
                  disabled={!formValid}>{t('Continue')}</button>
        </div>
      </div>
    );
  }
});

const InstallWizard = React.createClass({
  mixins: [
    ApiMixin
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      options: {},
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData(callback) {
    this.api.request('/internal/options/', {
      method: 'GET',
      success: (data) => {
        this.setState({
          options: data,
          loading: false,
          error: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  render() {
    let {error, loading, options} = this.state;
    let version = ConfigStore.get('version');
    return (
      <DocumentTitle title="Sentry Setup">
        <div className="app">
          <div className="container">
            <div className="setup-wizard">
              <h1>
                <span>{t('Welcome to Sentry')}</span>
                <small>{version.current}</small>
              </h1>
              {loading ?
                <LoadingIndicator>
                  Please wait while we loading configuration.
                </LoadingIndicator>
              : (error ?
                <div className="loading-error">
                  <span className="icon" />
                  {t('We were unable to load the required configuration from the Sentry server. Please take a look at the service logs.')}
                </div>
              :
                <InstallWizardSettings options={options} />
              )}
            </div>
          </div>
        </div>
      </DocumentTitle>
    );
  }
});

export default InstallWizard;
