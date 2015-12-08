import React from 'react';
import DocumentTitle from 'react-document-title';
import _ from 'underscore';

import {t} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import ConfigStore from '../stores/configStore';
import IndicatorStore from '../stores/indicatorStore';
import LoadingIndicator from '../components/loadingIndicator';
import {getOption, getOptionField} from '../options';

const InstallWizardSettings = React.createClass({
  getInitialState() {
    let options = {...this.props.options};
    let requiredOptions = Object.keys(_.pick(options, (option) => {
      return option.field.required && !option.field.disabled;
    }));
    let missingOptions = new Set(requiredOptions.filter(option => !options[option].value));
    let fields = [];
    // This is to handle the initial installation case.
    // Even if all options are filled out, we want to prompt to confirm
    // them. This is a bit of a hack because we're assuming that
    // the backend only spit back all filled out options for
    // this case.
    if (missingOptions.size === 0) {
      missingOptions = new Set(requiredOptions);
    }
    for (let key of missingOptions) {
      let option = options[key];
      if (!option.value) {
        option.value = getOption(key).defaultValue();
      }
      fields.push(getOptionField(key, this.onFieldChange.bind(this, key), option.value, option.field));
      // options is used for submitting to the server, and we dont submit values
      // that are deleted
      if (option.field.disabled) {
        delete options[key];
      }
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

  onSubmit(e) {
    e.preventDefault();
    this.props.onSubmit(this.state.options);
  },

  render() {
    let {fields, required, options} = this.state;
    let formValid = !required.filter(option => !options[option].value).length;
    let disabled = !formValid || this.props.formDisabled;

    return (
      <form onSubmit={this.onSubmit}>
        <p>Welcome to Sentry, yo! Complete setup by filling out the required
          configuration.</p>

        {fields.length ? fields :
          <p>Nothing needs to be done here. Enjoy.</p>
        }

        <div className="form-actions" style={{marginTop: 25}}>
          <button className="btn btn-primary"
                  disabled={disabled}
                  type="submit">{t('Continue')}</button>
        </div>
      </form>
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
      submitError: false,
      submitInProgress: false,
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
      submitError: false,
    });
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    // We only want to send back the values which weren't disabled
    let data = _.mapObject(
      _.pick(options, option => !option.field.disabled),
      option => option.value
    );
    this.api.request('/internal/options/', {
      method: 'PUT',
      data: data,
      success: () => {
        this.setState({
          submitInProgress: false,
        });
        this.props.onConfigured();
      },
      error: () => {
        this.setState({
          submitInProgress: false,
          submitError: true,
        });
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  render() {
    let {error, loading, options, submitError, submitInProgress} = this.state;
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
                  Please wait while we load configuration.
                </LoadingIndicator>
              : (error ?
                <div className="loading-error">
                  <span className="icon" />
                  {t('We were unable to load the required configuration from the Sentry server. Please take a look at the service logs.')}
                </div>
              :
                <div>
                  {submitError &&
                    <p>{t('We were unable to submit your changes to the Sentry server. Please take a look at the service logs.')}</p>
                  }
                  <InstallWizardSettings
                      options={options}
                      onSubmit={this.onSubmit}
                      formDisabled={submitInProgress} />
                </div>
              )}
            </div>
          </div>
        </div>
      </DocumentTitle>
    );
  }
});

export default InstallWizard;
