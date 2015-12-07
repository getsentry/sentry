import React from 'react';
import DocumentTitle from 'react-document-title';
import _ from 'underscore';

import {t} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import ConfigStore from '../stores/configStore';
import LoadingIndicator from '../components/loadingIndicator';
import {getOption, getOptionField} from '../options';

const InstallWizardSettings = React.createClass({
  getInitialState() {
    let options = {...this.props.options};
    let requiredOptions = Object.keys(_.pick(options, option => option.field.required));
    let missingOptions = new Set(requiredOptions.filter(option => !options[option].value));
    let fields = [];
    for (let option of missingOptions) {
      if (!options[option].value) {
        // TODO(dcramer): this should not be mutated
        options[option].value = getOption(option).defaultValue;
      }
      fields.push(getOptionField(option, this.onFieldChange.bind(this, option), options.value));
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
    let disabled = !formValid || this.props.formDisabled;

    return (
      <div>
        <p>Welcome to Sentry, yo! Complete setup by filling out the required
          configuration.</p>

        {fields.length ? fields :
          <p>Nothing needs to be done here. Enjoy.</p>
        }

        <div className="form-actions" style={{marginTop: 25}}>
          <button className="btn btn-primary"
                  disabled={disabled} onClick={this.onClick}>{t('Continue')}</button>
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
      submitInProgress: false,
      currentOptions: {}
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
    this.setState({
      submitInProgress: true,
    });

    let data = _.mapObject(options, option => option.value);
    this.api.request('/internal/options/', {
      method: 'PUT',
      data: data,
      success: this.props.onConfigured,
      error: () => {
        this.setState({
          submitInProgress: false,
        });
      },
    });
  },

  render() {
    let {error, loading, options, submitInProgress} = this.state;
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
                <InstallWizardSettings
                    options={options}
                    onSubmit={this.onSubmit}
                    formDisabled={submitInProgress} />
              )}
            </div>
          </div>
        </div>
      </DocumentTitle>
    );
  }
});

export default InstallWizard;
