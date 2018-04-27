import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import DocumentTitle from 'react-document-title';

import ApiMixin from 'app/mixins/apiMixin';
import AutoSelectText from 'app/components/autoSelectText';
import ConfigStore from 'app/stores/configStore';
import {FormState, TextField, TextareaField} from 'app/components/forms';
import IndicatorStore from 'app/stores/indicatorStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';

const ApiApplicationDetails = createReactClass({
  displayName: 'ApiApplicationDetails',

  contextTypes: {
    router: PropTypes.object.isRequired,
  },

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

  getFormData(app) {
    return {
      name: app.name,
      homepageUrl: app.homepageUrl,
      privacyUrl: app.privacyUrl,
      termsUrl: app.termsUrl,
      allowedOrigins: app.allowedOrigins.join('\n'),
      redirectUris: app.redirectUris.join('\n'),
    };
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
          formData: {...this.getFormData(data)},
          errors: {},
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  onFieldChange(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({
      formData,
    });
  },

  onSubmit(e) {
    e.preventDefault();

    if (this.state.state == FormState.SAVING) {
      return;
    }
    this.setState(
      {
        state: FormState.SAVING,
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        let formData = this.state.formData;
        this.api.request(`/api-applications/${this.props.params.appId}/`, {
          method: 'PUT',
          data: {
            ...formData,
            allowedOrigins: formData.allowedOrigins.split('\n').filter(v => v),
            redirectUris: formData.redirectUris.split('\n').filter(v => v),
          },
          success: data => {
            IndicatorStore.remove(loadingIndicator);
            this.setState({
              state: FormState.READY,
              formData: {...this.getFormData(data)},
              errors: {},
            });
            this.context.router.push('/api/applications/');
          },
          error: error => {
            IndicatorStore.remove(loadingIndicator);
            this.setState({
              state: FormState.ERROR,
              errors: error.responseJSON,
            });
          },
        });
      }
    );
  },

  onRemoveApplication(app) {},

  getTitle() {
    return 'Application Details';
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    let app = this.state.app;
    let isSaving = this.state.state === FormState.SAVING;
    let errors = this.state.errors;

    let urlPrefix = ConfigStore.get('urlPrefix');

    return (
      <DocumentTitle title={this.getTitle()}>
        <div>
          <form onSubmit={this.onSubmit} className="form-stacked">
            <h4>{t('Application Details')}</h4>
            {this.state.state === FormState.ERROR && (
              <div className="alert alert-error alert-block">
                {t(
                  'Unable to save your changes. Please ensure all fields are valid and try again.'
                )}
              </div>
            )}
            <fieldset>
              <TextField
                key="name"
                name="name"
                label={t('Name')}
                placeholder={t('e.g. My Application')}
                value={this.state.formData.name}
                required={true}
                error={errors.name}
                onChange={this.onFieldChange.bind(this, 'name')}
              />
              <TextField
                key="homepageUrl"
                name="homepageUrl"
                label={t('Homepage')}
                placeholder={t('e.g. http://example.com')}
                value={this.state.formData.homepageUrl}
                help={t("An optional link to your website's homepage")}
                required={false}
                error={errors.homepageUrl}
                onChange={this.onFieldChange.bind(this, 'homepageUrl')}
              />
              <TextField
                key="privacyUrl"
                name="privacyUrl"
                label={t('Privacy Policy')}
                placeholder={t('e.g. http://example.com/privacy')}
                value={this.state.formData.privacyUrl}
                help={t('An optional link to your Privacy Policy')}
                required={false}
                error={errors.privacyUrl}
                onChange={this.onFieldChange.bind(this, 'privacyUrl')}
              />
              <TextField
                key="termsUrl"
                name="termsUrl"
                label={t('Terms of Service')}
                placeholder={t('e.g. http://example.com/terms')}
                value={this.state.formData.termsUrl}
                help={t('An optional link to your Terms of Service')}
                required={false}
                error={errors.termsUrl}
                onChange={this.onFieldChange.bind(this, 'termsUrl')}
              />
            </fieldset>
            <fieldset>
              <legend>{t('Credentials')}</legend>
              <div className="control-group">
                <label htmlFor="api-key">Client ID</label>
                <div className="form-control disabled">
                  <AutoSelectText>{app.clientID}</AutoSelectText>
                </div>
              </div>
              <div className="control-group">
                <label htmlFor="api-key">Client Secret</label>
                <div className="form-control disabled">
                  {app.clientSecret ? (
                    <AutoSelectText>{app.clientSecret}</AutoSelectText>
                  ) : (
                    <em>hidden</em>
                  )}
                </div>
                <p className="help-block">
                  {t(`Your secret is only available briefly after application creation. Make
                  sure to save this value!`)}
                </p>
              </div>

              <div className="control-group">
                <label htmlFor="api-key">{t('Authorization URL')}</label>
                <div className="form-control disabled">
                  <AutoSelectText>{`${urlPrefix}/oauth/authorize/`}</AutoSelectText>
                </div>
              </div>

              <div className="control-group">
                <label htmlFor="api-key">{t('Token URL')}</label>
                <div className="form-control disabled">
                  <AutoSelectText>{`${urlPrefix}/oauth/token/`}</AutoSelectText>
                </div>
              </div>
            </fieldset>
            <fieldset>
              <legend>{t('Security')}</legend>
              <TextareaField
                key="redirectUris"
                name="redirectUris"
                label={t('Authorized Redirect URIs')}
                value={this.state.formData.redirectUris}
                required={false}
                help={t('Separate multiple entries with a newline.')}
                placeholder={t('e.g. https://example.com/oauth/complete')}
                error={errors.redirectUris}
                onChange={this.onFieldChange.bind(this, 'redirectUris')}
              />
              <TextareaField
                key="allowedOrigins"
                name="allowedOrigins"
                label={t('Authorized JavaScript Origins')}
                value={this.state.formData.allowedOrigins}
                required={false}
                help={t('Separate multiple entries with a newline.')}
                placeholder={t('e.g. example.com')}
                error={errors.allowedOrigins}
                onChange={this.onFieldChange.bind(this, 'allowedOrigins')}
              />
            </fieldset>
            <fieldset className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {t('Save Changes')}
              </button>
            </fieldset>
          </form>
        </div>
      </DocumentTitle>
    );
  },
});

export default ApiApplicationDetails;
