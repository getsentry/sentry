import React from 'react';
import underscore from 'underscore';

import {
  Form,
  FormState,
  GenericField
} from '../../components/forms';
import {Client} from '../../api';
import IndicatorStore from '../../stores/indicatorStore';
import LoadingIndicator from '../../components/loadingIndicator';
import {t} from '../../locale';


class PluginSettings extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.fetchData = this.fetchData.bind(this);

    this.state = {
      fieldList: null,
      initialData: null,
      formData: null,
      errors: {},
      state: FormState.READY
    };
  }

  componentWillMount() {
    this.api = new Client();
  }

  componentDidMount() {
    this.fetchData();
  }

  componentWillUnmount() {
    this.api.clear();
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
    if (this.state.state == FormState.SAVING) {
      return;
    }
    this.setState({
      state: FormState.SAVING,
    }, () => {
      let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
      this.api.request(this.getPluginEndpoint(), {
        data: this.state.formData,
        method: 'PUT',
        success: (data) => {
          let formData = {};
          data.config.forEach((field) => {
            formData[field.name] = field.value || field.defaultValue;
          });
          this.setState({
            formData: formData,
            initialData: Object.assign({}, formData),
            state: FormState.READY,
            errors: {},
          });
        },
        error: (error) => {
          this.setState({
            state: FormState.ERROR,
            errors: (error.responseJSON || {}).errors || {},
          });
          IndicatorStore.add(t('Unable to save changes. Please try again.'), 'error', {
            duration: 3000
          });
        },
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  }

  fetchData() {
    this.api.request(this.getPluginEndpoint(), {
      success: (data) => {
        let formData = {};
        data.config.forEach((field) => {
          formData[field.name] = field.value || field.defaultValue;
        });
        this.setState({
          fieldList: data.config,
          state: FormState.LOADING,
          formData: formData,
          initialData: Object.assign({}, formData)
        });
      },
      error: (error) => {
        this.setState({
          state: FormState.ERROR,
        });
      }
    });
  }

  render() {
    if (!this.state.fieldList) {
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
          return (
            <GenericField
              config={f}
              formData={this.state.formData}
              formErrors={this.state.errors}
              onChange={this.changeField.bind(this, f.name)} />
          );
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
