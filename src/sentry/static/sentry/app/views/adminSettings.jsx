import React from 'react';
import _ from 'underscore';

import AlertActions from '../actions/alertActions';
import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';
import {getOption, getOptionField} from '../options';
import {Form} from '../components/forms';

const optionsAvailable = [
  'system.url-prefix',
  'system.admin-email',
  'system.rate-limit',
];

const SettingsList = React.createClass({
  propTypes: {
    formDisabled: React.PropTypes.bool,
    options: React.PropTypes.object.isRequired,
    onSubmit: React.PropTypes.func.isRequired,
  },

  getInitialState() {
    let options = this.props.options;
    let formData = {};
    let required = [];
    let fields = [];
    for (let key of optionsAvailable) {
      // TODO(dcramer): we should not be mutating options
      let option = options[key] || {field: {}};
      if (typeof option.value === 'undefined' || option.value === '') {
        let defn = getOption(key);
        formData[key] = defn.defaultValue ? defn.defaultValue() : '';
      } else {
        formData[key] = option.value;
      }
      if (option.field.required) {
        required.push(key);
      }
      fields.push(getOptionField(key, this.onFieldChange.bind(this, key), formData[key], option.field));
    }

    return {
      required: required,
      formData: formData,
      fields: fields,
    };
  },

  onFieldChange(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({
      formData: formData
    });
  },

  onSubmit(e) {
    this.props.onSubmit(this.state.formData);
  },

  render() {
    let {fields, required, formData} = this.state;
    let formValid = !required.filter(option => !formData[option]).length;
    let submitDisabled = !formValid || this.props.formDisabled;

    return (
      <Form onSubmit={this.onSubmit} submitDisabled={submitDisabled}>
        {fields}
      </Form>
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

  onSubmit(formData) {
    this.setState({
      submitInProgress: true,
      submitError: false,
    });
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    // We only want to send back the values which weren't disabled
    formData = _.pick(formData, (value, key) => {
      return !this.state.options[key].field.disabled;
    });
    this.api.request('/internal/options/', {
      method: 'PUT',
      data: formData,
      success: () => {
        this.setState({
          submitInProgress: false,
        });
        AlertActions.addAlert({
            message: t('Your changes were saved, and will propagate to services shortly.'),
            type: 'success'
        });
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
