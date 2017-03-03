import React from 'react';
import DocumentTitle from 'react-document-title';
import _ from 'underscore';

import {t} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import ConfigStore from '../stores/configStore';
import IndicatorStore from '../stores/indicatorStore';
import LoadingIndicator from '../components/loadingIndicator';
import {getOption, getOptionField, getForm} from '../options';

const InstallWizardSettings = React.createClass({
  propTypes: {
    options: React.PropTypes.object.isRequired,
    formDisabled: React.PropTypes.bool,
    onSubmit: React.PropTypes.func.isRequired
  },

  getInitialState() {
    let options = {...this.props.options};
    let requiredOptions = Object.keys(_.pick(options, (option) => {
      return option.field.required && !option.field.disabled;
    }));
    let missingOptions = new Set(requiredOptions.filter(option => !options[option].field.isSet));
    // This is to handle the initial installation case.
    // Even if all options are filled out, we want to prompt to confirm
    // them. This is a bit of a hack because we're assuming that
    // the backend only spit back all filled out options for
    // this case.
    if (missingOptions.size === 0) {
      missingOptions = new Set(requiredOptions);
    }

    // A mapping of option name to Field object
    let fields = {};

    for (let key of missingOptions) {
      let option = options[key];
      if (!option.field.isSet) {
        let o = getOption(key);
        option.value = o.defaultValue ? o.defaultValue() : '';
      }
      fields[key] = getOptionField(key, this.onFieldChange.bind(this, key), option.value, option.field);
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
    let formValid = !required.filter(option => !options[option].field.allowEmpty && !options[option].value).length;
    let disabled = !formValid || this.props.formDisabled;

    return (
      <form onSubmit={this.onSubmit}>
        <p>Welcome to Sentry, yo! Complete setup by filling out the required
          configuration.</p>

        {getForm(fields)}

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
  propTypes: {
    onConfigured: React.PropTypes.func.isRequired
  },

  mixins: [
    ApiMixin
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      options: {},
      submitError: false,
      submitErrorType: null,
      submitInProgress: false,
    };
  },

  componentWillMount() {
    this.fetchData();
    jQuery(document.body).addClass('install-wizard');
  },

  componentWillUnmount() {
    jQuery(document.body).removeClass('install-wizard');
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData(callback) {
    // TODO(dcramer): ideally this would only be fetching options that aren't
    // already configured
    this.api.request('/internal/options/?query=is:required', {
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
      error: (xhr, textStatus, errorThrown) => {
        let err = {};
        try {
          err = xhr.responseJSON;
        } catch(ex) {
          // ...
        }
        let errorMessage = '';
        if (err.detail) {
          // err.detail comes back on some API responses
          // specifically on a failed CSRF
          errorMessage = err.detail;
        } else {
          switch (err.error) {
            case 'unknown_option':
              errorMessage = t('An invalid option (%s) was passed to the server. Please report this issue to the Sentry team.',
                               err.errorDetail.option);
              break;
            case 'invalid_type':
              errorMessage = t('An invalid value for (%s) was passed to the server.',
                               err.errorDetail.option);
              break;
            default:
              errorMessage = t('An unknown error occurred. Please take a look at the service logs.');
          }
        }
        this.setState({
          submitInProgress: false,
          submitError: true,
          submitErrorMessage: errorMessage,
          submitErrorType: err.error,
        });
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  render() {
    let {error, loading, options, submitError, submitErrorMessage, submitInProgress} = this.state;
    let version = ConfigStore.get('version');
    return (
      <DocumentTitle title={t('Sentry Setup')}>
        <div className="app">
          <div className="pattern" />
          <div className="setup-wizard">
            <h1>
              <span>{t('Welcome to Sentry')}</span>
              <small>{version.current}</small>
            </h1>
            {loading ?
              <LoadingIndicator>
                {t('Please wait while we load configuration.')}
              </LoadingIndicator>
            : (error ?
              <div className="loading-error">
                <span className="icon-exclamation" />
                {t('We were unable to load the required configuration from the Sentry server. Please take a look at the service logs.')}
              </div>
            :
              <div>
                {submitError &&
                  <div className="alert alert-block alert-error">
                    {submitErrorMessage}
                  </div>
                }
                <InstallWizardSettings
                    options={options}
                    onSubmit={this.onSubmit}
                    formDisabled={submitInProgress} />
              </div>
            )}
          </div>
        </div>
      </DocumentTitle>
    );
  }
});

export default InstallWizard;
