import React from 'react';
import _ from 'lodash';
import {Form, FormState, LoadingIndicator, plugins} from 'sentry';


class Settings extends plugins.BasePlugin.DefaultSettings {
  constructor(props) {
    super(props);
    this.PAGE_FIELD_LIST = {
      '0': ['instance_url', 'username', 'password'],
      '1': ['default_project'],
      '2': ['ignored_fields','default_priority', 'default_issue_type', 'auto_create']
    }

    this.back = this.back.bind(this);
    this.startEditing = this.startEditing.bind(this);
    this.isLastPage = this.isLastPage.bind(this);

    Object.assign(this.state, {
      page: 0
    });
  }

  isConfigured(state) {
    state = state || this.state;
    return !!(this.state.formData && this.state.formData.default_project);
  }

  isLastPage() {
    return this.state.page === 2;
  }

  fetchData() {
    // This is mostly copy paste of parent class
    // except for setting edit state
    this.api.request(this.getPluginEndpoint(), {
      success: data => {
        let formData = {};
        let initialData = {};
        data.config.forEach((field) => {
          formData[field.name] = field.value || field.defaultValue;
          initialData[field.name] = field.value;
        });
        this.setState({
          fieldList: data.config,
          formData: formData,
          initialData: initialData,
          // start off in edit mode if there isn't a project set
          editing: !(formData && formData.default_project),
        // call this here to prevent FormState.READY from being
        // set before fieldList is
        }, this.onLoadSuccess);
      },
      error: this.onLoadError
    });
  }

  startEditing() {
    this.setState({editing: true});
  }

  onSubmit() {
    if (_.isEqual(this.state.initialData, this.state.formData)) {
      if (this.isLastPage()) {
        this.setState({editing: false, page: 0})
      } else {
        this.setState({page: this.state.page + 1});
      }
      this.onSaveSuccess(this.onSaveComplete);
      return;
    }
    let formData = Object.assign({}, this.state.formData);
    // if the project has changed, it's likely these values aren't valid anymore
    if (formData.default_project !== this.state.initialData.default_project) {
      formData.default_issue_type = null;
      formData.default_priority = null;
    }
    this.api.request(this.getPluginEndpoint(), {
      data: formData,
      method: 'PUT',
      success: this.onSaveSuccess.bind(this, data => {
        let formData = {};
        let initialData = {};
        data.config.forEach((field) => {
          formData[field.name] = field.value || field.defaultValue;
          initialData[field.name] = field.value;
        });
        let state = {
          formData: formData,
          initialData: initialData,
          errors: {},
          fieldList: data.config
        };
        if (this.isLastPage()) {
          state.editing = false;
          state.page = 0;
        } else {
          state.page = this.state.page + 1;
        }
        this.setState(state);
      }),
      error: this.onSaveError.bind(this, error => {
        this.setState({
          errors: (error.responseJSON || {}).errors || {},
        });
      }),
      complete: this.onSaveComplete
    });
  }

  back(ev) {
    ev.preventDefault();
    if (this.state.state === FormState.SAVING) {
      return;
    }
    this.setState({
      page: this.state.page - 1
    });
  }

  render() {
    if (this.state.state === FormState.LOADING) {
      return <LoadingIndicator />;
    }

    if (this.state.state === FormState.ERROR && !this.state.fieldList) {
      return (
        <div className="alert alert-error m-b-1">
          An unknown error occurred. Need help with this? <a href="https://sentry.io/support/">Contact support</a>
        </div>
      );
    }

    let isSaving = this.state.state === FormState.SAVING;

    let fields;
    let onSubmit;
    let submitLabel;
    if (this.state.editing) {
      fields = this.state.fieldList.filter(f => {
        return this.PAGE_FIELD_LIST[this.state.page].includes(f.name);
      });
      onSubmit = this.onSubmit;
      submitLabel = this.isLastPage() ? 'Finish' : 'Save and Continue';
    } else {
      fields = this.state.fieldList.map(f => {
        return Object.assign({}, f, {readonly: true});
      });
      onSubmit = this.startEditing;
      submitLabel = 'Edit';
    }
    return (
      <Form onSubmit={onSubmit}
            submitDisabled={isSaving}
            submitLabel={submitLabel}
            extraButton={this.state.page === 0 ? null :
                         <a href="#"
                            className={'btn btn-default pull-left' + (isSaving ? ' disabled' : '')}
                            onClick={this.back}>Back</a>}>
        {this.state.errors.__all__ &&
          <div className="alert alert-block alert-error">
            <ul>
              <li>{this.state.errors.__all__}</li>
            </ul>
          </div>
        }
        {fields.map(f => {
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

export default Settings;
