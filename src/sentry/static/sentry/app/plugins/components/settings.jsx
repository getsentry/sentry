import React from 'react';
import underscore from 'underscore';

import {
  Form,
  FormState
} from '../../components/forms';
import PluginComponentBase from '../../components/bases/pluginComponentBase';
import LoadingIndicator from '../../components/loadingIndicator';


class PluginSettings extends PluginComponentBase {
  constructor(props) {
    super(props);

    Object.assign(this.state, {
      fieldList: null,
      initialData: null,
      formData: null,
      errors: {},
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
        data.config.forEach((field) => {
          formData[field.name] = field.value || field.defaultValue;
        });
        this.setState({
          formData: formData,
          initialData: Object.assign({}, formData),
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
        let formData = {};
        data.config.forEach((field) => {
          formData[field.name] = field.value || field.defaultValue;
        });
        this.setState({
          fieldList: data.config,
          formData: formData,
          initialData: Object.assign({}, formData)
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
