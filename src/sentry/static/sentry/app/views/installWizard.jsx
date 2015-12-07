import React from 'react';
import DocumentTitle from 'react-document-title';
import _ from 'underscore';

import {t} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import ConfigStore from '../stores/configStore';
import LoadingIndicator from '../components/loadingIndicator';
import {EmailField, TextField} from '../components/forms';


const OPTIONS_META = {
  'system.url-prefix': {
    label: t('Root URL'),
    placeholder: 'https://sentry.example.com',
    help: t('The root web address which is used to communicate with the Sentry backend.'),
    defaultValue: () => `${document.location.protocol}//${document.location.host}`
  },
  'system.admin-email': {
    label: t('Admin Email'),
    placeholder: 'admin@example.com',
    help: t('The technical contact for this Sentry installation.'),
    component: EmailField,
    defaultValue: () => ConfigStore.get('user').email
  }
};

function makeField(option, onChange) {
  let meta = OPTIONS_META[option];
  let Field = meta.component || TextField;
  return (
    <Field
        key={option}
        label={meta.label}
        defaultValue={meta.defaultValue()}
        placeholder={meta.placeholder}
        help={meta.help}
        onChange={onChange}
    />
  );
}


const InstallWizardSettings = React.createClass({

  getInitialState() {
    let options = {...this.props.initialOptions};
    let requiredOptions = Object.keys(_.pick(options, option => option.field.required));
    let missingOptions = new Set(requiredOptions.filter(option => !options[option].value));
    let fields = [];
    for (let option of missingOptions) {
      options[option].value = options[option].value || OPTIONS_META[option].defaultValue;
      fields.push(makeField(option, this.onFieldChange.bind(this, option)));
    }

    return {
      options: options,
      required: requiredOptions,
      fields: fields,
    };
  },

  onFieldChange(name, value) {
    let options = {...this.state.options};
    options[name].value = value;
    this.setState({
      options: options
    });
  },

  onClick() {
    this.props.onSubmit(this.state.options);
  },

  render() {
    let {fields, required, options} = this.state;
    let formValid = !required.filter(option => !options[option].value).length;

    return (
      <div>
        <p>Welcome to Sentry, yo! Complete setup by filling out the required
          configuration.</p>

        {fields.length ? fields :
          <p>Nothing needs to be done here. Enjoy.</p>
        }

        <div className="form-actions" style={{marginTop: 25}}>
          <button className="btn btn-primary"
                  disabled={!formValid} onClick={this.onClick}>{t('Continue')}</button>
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
      options: {}
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

  onSubmit(options) {
    let data = _.mapObject(options, option => option.value);
    this.api.request('/internal/options/', {
      method: 'PUT',
      data: data,
      success: this.props.onConfigured,
      error: () => {
        // Should do something here with an error
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
                <InstallWizardSettings initialOptions={options} onSubmit={this.onSubmit}/>
              )}
            </div>
          </div>
        </div>
      </DocumentTitle>
    );
  }
});

export default InstallWizard;
