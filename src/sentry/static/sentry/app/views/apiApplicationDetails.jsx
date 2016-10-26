import React from 'react';
import DocumentTitle from 'react-document-title';

import ApiMixin from '../mixins/apiMixin';
import AutoSelectText from '../components/autoSelectText';
import {FormState, TextField} from '../components/forms';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';

const ApiApplicationDetails = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      app: null,
      formData: null,
      errors: {},
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    this.setState({
      loading: true,
    });

    this.api.request(`/api-applications/${this.props.params.appId}/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          loading: false,
          error: false,
          app: data,
          formData: {...data},
          errors: {},
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      }
    });
  },

  onFieldChange(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({
      formData: formData,
    });
  },

  onSubmit(e) {
    e.preventDefault();

    if (this.state.state == FormState.SAVING) {
      return;
    }
    this.setState({
      state: FormState.SAVING,
    }, () => {
      let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
      this.api.request(`/api-applications/${this.props.params.appId}/`, {
        method: 'PUT',
        data: this.state.formData,
        success: (data) => {
          this.setState({
            state: FormState.READY,
            formData: {...data},
            errors: {},
          });
        },
        error: (error) => {
          this.setState({
            state: FormState.ERROR,
            errors: error.responseJSON,
          });
        },
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },

  onRemoveApplication(app) {

  },

  getTitle() {
    return 'Application Details - Sentry';
  },

  render() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let app = this.state.app;
    let isSaving = this.state.state === FormState.SAVING;
    let errors = this.state.errors;

    return (
      <DocumentTitle title={this.getTitle()}>
        <div>
          <h3>Application Details</h3>
          <form onSubmit={this.onSubmit} className="form-stacked">
            {this.state.state === FormState.ERROR &&
              <div className="alert alert-error alert-block">
                {t('Unable to save your changes. Please ensure all fields are valid and try again.')}
              </div>
            }
            <fieldset>
              <TextField
                key="name"
                name="name"
                label={t('Name')}
                placeholder={t('e.g. My Application')}
                value={this.state.formData.name}
                required={true}
                error={errors.name}
                onChange={this.onFieldChange.bind(this, 'name')} />
              <div className="control-group">
                <label htmlFor="api-key">Client ID</label>
                <div className="form-control disabled">
                  <AutoSelectText>{app.clientID}</AutoSelectText>
                </div>
              </div>
              <div className="control-group">
                <label htmlFor="api-key">Client Secret</label>
                <div className="form-control disabled">
                  {app.clientSecret ?
                    <AutoSelectText>{app.clientSecret}</AutoSelectText>
                  :
                    <em>hidden</em>
                  }
                </div>
                <p className="help-block">
                  Your secret is only available briefly after application creation. Make sure to save this value!
                </p>
              </div>
            </fieldset>
            <fieldset className="form-actions">
              <button type="submit" className="btn btn-primary"
                    disabled={isSaving}>{t('Save Changes')}</button>
            </fieldset>
          </form>
        </div>
      </DocumentTitle>
    );
  }
});

export default ApiApplicationDetails;
