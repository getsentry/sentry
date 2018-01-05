import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {
  addErrorMessage,
  addSuccessMessage,
} from '../../../actionCreators/settingsIndicator';
import {t} from '../../../locale';
import AsyncView from '../../asyncView';
import ConfigStore from '../../../stores/configStore';
import Form from '../components/forms/form';
import FormField from '../components/forms/formField';
import JsonForm from '../components/forms/jsonForm';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import TextCopyInput from '../components/forms/textCopyInput';
import apiApplication from '../../../data/forms/apiApplication';

class ApiApplicationDetails extends AsyncView {
  static contextTypes = {
    router: PropTypes.object.isRequired,
  };

  getDefaultState() {
    return {
      loading: true,
      error: false,
      app: null,
      formData: null,
      errors: {},
    };
  }

  getFormData(app) {
    return {
      name: app.name,
      homepageUrl: app.homepageUrl,
      privacyUrl: app.privacyUrl,
      termsUrl: app.termsUrl,
      allowedOrigins: app.allowedOrigins.join('\n'),
      redirectUris: app.redirectUris.join('\n'),
    };
  }

  getEndpoints() {
    return [['app', `/api-applications/${this.props.params.appId}/`]];
  }

  onFieldChange(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({
      formData,
    });
  }

  onRemoveApplication(app) {}

  getTitle() {
    return 'Application Details - Sentry';
  }

  handleSubmitSuccess = (change, model, id) => {
    if (!model) return;

    let label = model.getDescriptor(id, 'label');

    if (!label) return;

    addSuccessMessage(`Changed ${label} from "${change.old}" to "${change.new}"`, 2000, {
      model,
      id,
    });

    // Special case for slug, need to forward to new slug
    if (typeof onSave === 'function') {
      this.props.onSave(this.props.initialData, model.initialData);
    }
  };

  renderBody() {
    let urlPrefix = ConfigStore.get('urlPrefix');
    console.log(this.props);

    return (
      <div>
        <Form
          apiMethod="PUT"
          apiEndpoint={`/api-applications/${this.props.params.appId}/`}
          saveOnBlur
          allowUndo
          initialData={this.state.app}
          onSubmitSuccess={this.handleSubmitSuccess}
          onSubmitError={err => addErrorMessage('Unable to save change')}
        >
          <Box>
            <JsonForm location={this.props.location} forms={apiApplication} />

            <Panel>
              <PanelHeader>{t('Credentials')}</PanelHeader>

              <PanelBody>
                <FormField name="clientID" label="Client ID" overflow>
                  {({value}) => {
                    return (
                      <div>
                        <TextCopyInput>{value}</TextCopyInput>
                      </div>
                    );
                  }}
                </FormField>

                <FormField
                  overflow
                  name="clientSecret"
                  label="Client Secret"
                  help={t(`Your secret is only available briefly after application creation. Make
                  sure to save this value!`)}
                >
                  {({value}) => {
                    return value ? (
                      <TextCopyInput>{value}</TextCopyInput>
                    ) : (
                      <em>hidden</em>
                    );
                  }}
                </FormField>

                <FormField name="" label="Authorization URL">
                  {({value}) => {
                    return (
                      <TextCopyInput>{`${urlPrefix}/oauth/authorize/`}</TextCopyInput>
                    );
                  }}
                </FormField>

                <FormField name="" label="Token URL">
                  {() => {
                    let value = `${urlPrefix}/oauth/token/`;
                    return <TextCopyInput>{value}</TextCopyInput>;
                  }}
                </FormField>
              </PanelBody>
            </Panel>
          </Box>
        </Form>
      </div>
    );
  }
}

export default ApiApplicationDetails;
/*
          <form onSubmit={this.onSubmit} className="form-stacked">
            <h4>Application Details</h4>
            <fieldset>
              <legend>Credentials</legend>
              <div className="control-group">
                <label htmlFor="api-key">Client ID</label>
                <div className="form-control disabled">
                  <TextCopyInput>{app.clientID}</TextCopyInput>
                </div>
              </div>
              <div className="control-group">
                <label htmlFor="api-key">Client Secret</label>
                <div className="form-control disabled">
                  {app.clientSecret ? (
                    <TextCopyInput>{app.clientSecret}</TextCopyInput>
                  ) : (
                    <em>hidden</em>
                  )}
                </div>
                <p className="help-block">
                  Your secret is only available briefly after application creation. Make
                  sure to save this value!
                </p>
              </div>

              <div className="control-group">
                <label htmlFor="api-key">Authorization URL</label>
                <div className="form-control disabled">
                  <TextCopyInput>{`${urlPrefix}/oauth/authorize/`}</TextCopyInput>
                </div>
              </div>

              <div className="control-group">
                <label htmlFor="api-key">Token URL</label>
                <div className="form-control disabled">
                  <TextCopyInput>{`${urlPrefix}/oauth/token/`}</TextCopyInput>
                </div>
              </div>
            </fieldset>
          </form>
          */
