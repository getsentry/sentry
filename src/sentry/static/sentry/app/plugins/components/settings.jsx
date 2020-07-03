import PropTypes from 'prop-types';
import React from 'react';
import isEqual from 'lodash/isEqual';
import styled from '@emotion/styled';

import {Form, FormState} from 'app/components/forms';
import {parseRepo} from 'app/utils';
import {t, tct} from 'app/locale';
import LoadingIndicator from 'app/components/loadingIndicator';
import PluginComponentBase from 'app/components/bases/pluginComponentBase';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';

class PluginSettings extends PluginComponentBase {
  constructor(props, context) {
    super(props, context);

    Object.assign(this.state, {
      fieldList: null,
      initialData: null,
      formData: null,
      errors: {},
      rawData: {},
      // override default FormState.READY if api requests are
      // necessary to even load the form
      state: FormState.LOADING,
      wasConfiguredOnPageLoad: false,
    });
  }

  trackPluginEvent = options => {
    trackIntegrationEvent(
      {
        integration: this.props.plugin.id,
        integration_type: 'plugin',
        view: 'plugin_details',
        project_id: this.props.project.id,
        already_installed: this.state.wasConfiguredOnPageLoad,
        ...options,
      },
      this.props.organization
    );
  };

  componentDidMount() {
    this.fetchData();
  }

  getPluginEndpoint() {
    const org = this.props.organization;
    const project = this.props.project;
    return `/projects/${org.slug}/${project.slug}/plugins/${this.props.plugin.id}/`;
  }

  changeField(name, value) {
    const formData = this.state.formData;
    formData[name] = value;
    // upon changing a field, remove errors
    const errors = this.state.errors;
    delete errors[name];
    this.setState({formData, errors});
  }

  onSubmit() {
    if (!this.state.wasConfiguredOnPageLoad) {
      //Users cannot install plugins like other integrations but we need the events for the funnel
      //we will treat a user saving a plugin that wasn't already configured as an installation event
      this.trackPluginEvent({
        eventKey: 'integrations.installation_start',
        eventName: 'Integrations: Installation Start',
      });
    }

    let repo = this.state.formData.repo;
    repo = repo && parseRepo(repo);
    const parsedFormData = {...this.state.formData, repo};
    this.api.request(this.getPluginEndpoint(), {
      data: parsedFormData,
      method: 'PUT',
      success: this.onSaveSuccess.bind(this, data => {
        const formData = {};
        const initialData = {};
        data.config.forEach(field => {
          formData[field.name] = field.value || field.defaultValue;
          initialData[field.name] = field.value;
        });
        this.setState({
          fieldList: data.config,
          formData,
          initialData,
          errors: {},
        });
        this.trackPluginEvent({
          eventKey: 'integrations.config_saved',
          eventName: 'Integrations: Config Saved',
        });

        if (!this.state.wasConfiguredOnPageLoad) {
          this.trackPluginEvent({
            eventKey: 'integrations.installation_complete',
            eventName: 'Integrations: Installation Complete',
          });
        }
      }),
      error: this.onSaveError.bind(this, error => {
        this.setState({
          errors: (error.responseJSON || {}).errors || {},
        });
      }),
      complete: this.onSaveComplete,
    });
  }

  fetchData() {
    this.api.request(this.getPluginEndpoint(), {
      success: data => {
        if (!data.config) {
          this.setState(
            {
              rawData: data,
            },
            this.onLoadSuccess
          );
          return;
        }
        let wasConfiguredOnPageLoad = false;
        const formData = {};
        const initialData = {};
        data.config.forEach(field => {
          formData[field.name] = field.value || field.defaultValue;
          initialData[field.name] = field.value;
          //for simplicity sake, we will consider a plugin was configured if we have any value that is stored in the DB
          wasConfiguredOnPageLoad = wasConfiguredOnPageLoad || !!field.value;
        });
        this.setState(
          {
            fieldList: data.config,
            formData,
            initialData,
            wasConfiguredOnPageLoad,
            // call this here to prevent FormState.READY from being
            // set before fieldList is
          },
          this.onLoadSuccess
        );
      },
      error: this.onLoadError,
    });
  }

  render() {
    if (this.state.state === FormState.LOADING) {
      return <LoadingIndicator />;
    }
    const isSaving = this.state.state === FormState.SAVING;
    const hasChanges = !isEqual(this.state.initialData, this.state.formData);

    const data = this.state.rawData;
    if (data.config_error) {
      let authUrl = data.auth_url;
      if (authUrl.indexOf('?') === -1) {
        authUrl += '?next=' + encodeURIComponent(document.location.pathname);
      } else {
        authUrl += '&next=' + encodeURIComponent(document.location.pathname);
      }
      return (
        <div className="m-b-1">
          <div className="alert alert-warning m-b-1">{data.config_error}</div>
          <a className="btn btn-primary" href={authUrl}>
            {t('Associate Identity')}
          </a>
        </div>
      );
    }

    if (this.state.state === FormState.ERROR && !this.state.fieldList) {
      return (
        <div className="alert alert-error m-b-1">
          {tct('An unknown error occurred. Need help with this? [link:Contact support]', {
            link: <a href="https://sentry.io/support/" />,
          })}
        </div>
      );
    }

    if (!(this.state.fieldList || []).length) {
      return null;
    }
    return (
      <Form
        css={{width: '100%'}}
        onSubmit={this.onSubmit}
        submitDisabled={isSaving || !hasChanges}
      >
        <Flex>
          {this.state.errors.__all__ && (
            <div className="alert alert-block alert-error">
              <ul>
                <li>{this.state.errors.__all__}</li>
              </ul>
            </div>
          )}
          {this.state.fieldList.map(f =>
            this.renderField({
              key: f.name,
              config: f,
              formData: this.state.formData,
              formErrors: this.state.errors,
              onChange: this.changeField.bind(this, f.name),
            })
          )}
        </Flex>
      </Form>
    );
  }
}

PluginSettings.propTypes = {
  organization: PropTypes.object.isRequired,
  project: PropTypes.object.isRequired,
  plugin: PropTypes.object.isRequired,
};

const Flex = styled('div')`
  display: flex;
  flex-direction: column;
`;

export default PluginSettings;
