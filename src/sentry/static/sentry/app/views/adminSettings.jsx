import React from 'react';
import _ from 'underscore';

import AlertActions from '../actions/alertActions';
import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';
import {getOption, getOptionField} from '../options';

// TODO(dcramer): a lot of this is copied from InstallWizard
const SettingsList = React.createClass({
  getInitialState() {
    let options = {...this.props.options};
    let requiredOptions = Object.keys(_.pick(options, (option) => {
      return option.field.required && !option.field.disabled;
    }));
    let fields = [];
    for (let key of Object.keys(options)) {
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
        {fields}
        <div className="form-actions" style={{marginTop: 25}}>
          <button className="btn btn-primary"
                  disabled={disabled}
                  type="submit">{t('Save Changes')}</button>
        </div>
      </form>
    );
  }
});

const AdminSettings = React.createClass({
  mixins: [
    ApiMixin
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      submitInProgress: false,
      submitError: null,
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
    this.setState({
      submitInProgress: true,
      submitError: false,
    });
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    let data = _.mapObject(options, option => option.value);
    this.api.request('/internal/options/', {
      method: 'PUT',
      data: data,
      success: () => {
        this.setState({
          submitInProgress: false,
        });
        AlertActions.addAlert(t('Your changes were saved, and will propagate to services shortly.'), 'success');
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

    return (
      <div>
        <h3>{t('Settings')}</h3>

        {loading ?
          <LoadingIndicator>
            {t('Please wait while we load configuration.')}
          </LoadingIndicator>
        : (error ?
          <div className="loading-error">
            <span className="icon" />
            {t('We were unable to load the required configuration from the Sentry server. Please take a look at the service logs.')}
          </div>
        :
          <div>
            {submitError &&
              <div className="alert alert-block alert-error">{t('We were unable to submit your changes to the Sentry server. Please take a look at the service logs.')}</div>
            }
            <SettingsList
                options={options}
                onSubmit={this.onSubmit}
                formDisabled={submitInProgress} />
          </div>
        )}
      </div>
    );
  }
});

export default AdminSettings;
