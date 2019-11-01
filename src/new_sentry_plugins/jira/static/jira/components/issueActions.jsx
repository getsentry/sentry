import React from 'react';
import {Form, FormState, plugins} from 'sentry';


class IssueActions extends plugins.DefaultIssuePlugin.DefaultIssueActions {
  changeField(action, name, value) {
    let key = action + 'FormData';
    let formData = {
      ...this.state[key],
      [name]: value
    };
    let state = {
      [key]: formData
    };
    if (name === 'issuetype') {
      state.state = FormState.LOADING;
      this.setState(state, this.onLoad.bind(this, () => {
        this.api.request((this.getPluginCreateEndpoint() +
                          '?issuetype=' + encodeURIComponent(value)), {
          success: (data) => {
            // Try not to change things the user might have edited
            // unless they're no longer valid
            let oldData = this.state.createFormData;
            let createFormData = {};
            data.forEach((field) => {
              let val;
              if (field.choices && !field.choices.find(c => c[0] === oldData[field.name])) {
                val = field.default;
              } else {
                val = oldData[field.name] || field.default;
              }
              createFormData[field.name] = val;
            });
            this.setState({
              createFieldList: data,
              error: null,
              loading: false,
              createFormData: createFormData
            }, this.onLoadSuccess);
          },
          error: this.errorHandler
        });
      }))
      return;
    }
    this.setState(state);
  }

  renderForm() {
    let form;

    // For create form, split into required and optional fields
    if (this.props.actionType === 'create') {
      if (this.state.createFieldList) {
        let renderField = (field) => {
          if (field.has_autocomplete) {
            field = Object.assign({
              url: ('/api/0/issues/' + this.getGroup().id +
                    '/plugins/' + this.props.plugin.slug + '/autocomplete')
            }, field);
          }
          return (
            <div key={field.name}>
              {this.renderField({
                config: field,
                formData: this.state.createFormData,
                onChange: this.changeField.bind(this, 'create', field.name)
              })}
            </div>
          );
        };
        let isRequired = (f) => {
          return f.required != null ? f.required : true;
        };

        let fields = this.state.createFieldList;
        let requiredFields = fields.filter(f => isRequired(f)).map(f => renderField(f));
        let optionalFields = fields.filter(f => !isRequired(f)).map(f => renderField(f));
        form = (
          <Form onSubmit={this.createIssue} submitLabel='Create Issue' footerClass="">
            <h5>Required Fields</h5>
            {requiredFields}
            {optionalFields.length ? <h5>Optional Fields</h5> : null}
            {optionalFields}
          </Form>
        );
      }
    } else {
      form = super.renderForm();
    }

    return form;
  }
}

export default IssueActions;
