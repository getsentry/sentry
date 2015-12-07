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
    let requiredOptions = Object.keys(_.pick(options, option => option.field.required));
    let fields = [];
    for (let option of Object.keys(options)) {
      if (!options[option].value) {
        options[option].value = getOption(option).defaultValue;
      }
      fields.push(getOptionField(option, this.onFieldChange.bind(this, option), options[option].value, options[option].field));
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
        {fields}
        <div className="form-actions" style={{marginTop: 25}}>
          <button className="btn btn-primary"
                  disabled={disabled} onClick={this.onClick}>{t('Save Changes')}</button>
        </div>
      </div>
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
        <h3>Settings</h3>

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
