import * as React from 'react';

import {Form, FormState} from 'sentry/components/deprecatedforms';
import DefaultIssueActions from 'sentry/plugins/components/issueActions';
import {Writable} from 'sentry/types';

class IssueActions extends DefaultIssueActions {
  changeField = (
    action: DefaultIssueActions['props']['actionType'],
    name: string,
    value: any
  ) => {
    const key = this.getFormDataKey(action);
    const formData = {
      ...this.state[key],
      [name]: value,
    };
    const state: Pick<Writable<DefaultIssueActions['state']>, 'state' | typeof key> = {
      ...this.state,
      [key]: formData,
    };
    if (name === 'issuetype') {
      state.state = FormState.LOADING;
      this.setState(
        state,
        this.onLoad.bind(this, () => {
          this.api.request(
            this.getPluginCreateEndpoint() + '?issuetype=' + encodeURIComponent(value),
            {
              success: (data: DefaultIssueActions['state']['unlinkFieldList']) => {
                // Try not to change things the user might have edited
                // unless they're no longer valid
                const oldData = this.state.createFormData;
                const createFormData = {};
                data?.forEach(field => {
                  let val;
                  if (
                    field.choices &&
                    !field.choices.find(c => c[0] === oldData[field.name])
                  ) {
                    val = field.default;
                  } else {
                    val = oldData[field.name] || field.default;
                  }
                  createFormData[field.name] = val;
                });
                this.setState(
                  {
                    createFieldList: data,
                    error: undefined,
                    loading: false,
                    createFormData,
                  },
                  this.onLoadSuccess
                );
              },
              error: this.errorHandler,
            }
          );
        })
      );
      return;
    }
    this.setState(state);
  };

  renderForm(): React.ReactNode {
    let form: React.ReactNode = null;

    // For create form, split into required and optional fields
    if (this.props.actionType === 'create') {
      if (this.state.createFieldList) {
        const renderField = field => {
          if (field.has_autocomplete) {
            field = Object.assign(
              {
                url:
                  '/api/0/issues/' +
                  this.getGroup().id +
                  '/plugins/' +
                  this.props.plugin.slug +
                  '/autocomplete',
              },
              field
            );
          }
          return (
            <div key={field.name}>
              {this.renderField({
                config: field,
                formData: this.state.createFormData,
                onChange: this.changeField.bind(this, 'create', field.name),
              })}
            </div>
          );
        };
        const isRequired = f => (f.required !== null ? f.required : true);

        const fields = this.state.createFieldList;
        const requiredFields = fields.filter(f => isRequired(f)).map(f => renderField(f));
        const optionalFields = fields
          .filter(f => !isRequired(f))
          .map(f => renderField(f));
        form = (
          <Form onSubmit={this.createIssue} submitLabel="Create Issue" footerClass="">
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
