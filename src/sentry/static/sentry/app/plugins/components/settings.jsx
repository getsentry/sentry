import React from 'react';
import underscore from 'underscore';

import {
  Form,
  FormState
} from '../../components/forms';
import PluginComponentBase from '../../components/bases/pluginComponentBase';
import LoadingIndicator from '../../components/loadingIndicator';
import {t, tct} from '../../locale';


class PluginSettings extends PluginComponentBase {
  constructor(props) {
    super(props);

    Object.assign(this.state, {
      fieldList: null,
      initialData: null,
      formData: null,
      errors: {},
      rawData: {},
      // override default FormState.READY if api requests are
      // necessary to even load the form
      state: FormState.LOADING
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  getPluginEndpoint() {
    let org = this.props.organization;
    let project = this.props.project;
    return (
      `/projects/${org.slug}/${project.slug}/plugins/${this.props.plugin.id}/`
    );
  }

  changeField(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    // upon changing a field, remove errors
    let errors = this.state.errors;
    delete errors[name];
    this.setState({formData: formData, errors: errors});
  }

  onSubmit() {
    this.api.request(this.getPluginEndpoint(), {
      data: this.state.formData,
      method: 'PUT',
      success: this.onSaveSuccess.bind(this, data => {
        let formData = {};
        let initialData = {};
        data.config.forEach((field) => {
          formData[field.name] = field.value || field.defaultValue;
          initialData[field.name] = field.value;
        });
        this.setState({
          formData: formData,
          initialData: initialData,
          errors: {}
        });
      }),
      error: this.onSaveError.bind(this, error => {
        this.setState({
          errors: (error.responseJSON || {}).errors || {},
        });
      }),
      complete: this.onSaveComplete
    });
  }

  fetchData() {
    this.api.request(this.getPluginEndpoint(), {
      success: data => {
        if (!data.config) {
          this.setState({
            rawData: data
          }, this.onLoadSuccess);
          return;
        }
        let formData = {};
        let initialData = {};
        data.config.forEach((field) => {
          formData[field.name] = field.value || field.defaultValue;
          initialData[field.name] = field.value;
        });
        this.setState({
          fieldList: data.config,
          formData: formData,
          initialData: initialData
        // call this here to prevent FormState.READY from being
        // set before fieldList is
        }, this.onLoadSuccess);
      },
      error: this.onLoadError
    });
  }

  render() {
    if (this.state.state === FormState.LOADING) {
      return <LoadingIndicator />;
    }
    let isSaving = this.state.state === FormState.SAVING;
    let hasChanges = !underscore.isEqual(this.state.initialData, this.state.formData);

    let data = this.state.rawData;
    if (data.config_error) {
      let authUrl = data.auth_url;
      if (authUrl.indexOf('?') === -1) {
        authUrl += '?next=' + encodeURIComponent(document.location.pathname);
      } else {
        authUrl += '&next=' + encodeURIComponent(document.location.pathname);
      }
      return (
        <div className="m-b-1">
          <div className="alert alert-warning m-b-1">
            {data.config_error}
          </div>
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
            link: <a href="https://sentry.io/support/"/>
          })}
        </div>
      );
    }
    return (
      <Form onSubmit={this.onSubmit} submitDisabled={isSaving || !hasChanges}>
        {this.state.errors.__all__ &&
          <div className="alert alert-block alert-error">
            <ul>
              <li>{this.state.errors.__all__}</li>
            </ul>
          </div>
        }
        {this.state.fieldList.map(f => {
          return this.renderField({
            config: f,
            formData: this.state.formData,
            formErrors: this.state.errors,
            onChange: this.changeField.bind(this, f.name)
          });
        })}
      </Form>
    );
  }
}

PluginSettings.propTypes = {
  organization: React.PropTypes.object.isRequired,
  project: React.PropTypes.object.isRequired,
  plugin: React.PropTypes.object.isRequired,
};

export default PluginSettings;
