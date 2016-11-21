import React from 'react';
import DocumentTitle from 'react-document-title';
import {browserHistory} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import NarrowLayout from '../components/narrowLayout';
import {FormState, MultipleCheckboxField} from '../components/forms';
import {t, tct} from '../locale';

const SCOPES = new Set([
  'project:read',
  'project:write',
  'project:delete',
  'project:releases',
  'team:read',
  'team:write',
  'team:delete',
  'event:read',
  'event:write',
  'event:delete',
  'org:read',
  'org:write',
  'org:delete',
  'member:read',
  'member:write',
  'member:delete'
]);

const DEFAULT_SCOPES = new Set([
  'event:read',
  'event:write',
  'project:read',
  'project:releases',
  'org:read',
  'team:read',
  'member:read',
]);

const TokenForm = React.createClass({
  propTypes: {
    initialData: React.PropTypes.object,
    onSave: React.PropTypes.func.isRequired,
    onCancel: React.PropTypes.func.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      formData: Object.assign({}, this.props.initialData),
      errors: {},
    };
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
      this.api.request('/api-tokens/', {
        method: 'POST',
        data: this.state.formData,
        success: (data) => {
          this.setState({
            state: FormState.READY,
            errors: {},
          });
          IndicatorStore.remove(loadingIndicator);
          this.props.onSave(data);
        },
        error: (error) => {
          this.setState({
            state: FormState.ERROR,
            errors: error.responseJSON,
          });
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let errors = this.state.errors;

    return (
      <form onSubmit={this.onSubmit} className="form-stacked api-new-token">
        {this.state.state === FormState.ERROR &&
          <div className="alert alert-error alert-block">
            {t('Unable to save your changes. Please ensure all fields are valid and try again.')}
          </div>
        }
        <fieldset>
          <MultipleCheckboxField
            key="scopes"
            choices={Array.from(SCOPES.keys()).map((s) => [s, s])}
            label={t('Scopes')}
            value={this.state.formData.scopes}
            required={true}
            error={errors.scopes}
            onChange={this.onFieldChange.bind(this, 'scopes')} />
       </fieldset>
        <fieldset className="form-actions">
          <button className="btn btn-default"
                  disabled={isSaving} onClick={this.props.onCancel}>{t('Cancel')}</button>
          <button type="submit" className="btn btn-primary pull-right"
                  disabled={isSaving}>{t('Save Changes')}</button>
        </fieldset>
      </form>
    );
  }
});

const ApiNewToken = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
    };
  },

  getTitle() {
    return 'Sentry API';
  },

  onCancel() {
    browserHistory.pushState(null, '/api/');
  },

  onSave() {
    browserHistory.pushState(null, '/api/');
  },

  render() {
    let defaultScopes = Array.from(DEFAULT_SCOPES);
    defaultScopes.sort();

    return (
      <DocumentTitle title={this.getTitle()}>
        <NarrowLayout>
          <h3>{t('Create New Token')}</h3>

          <hr />

          <p>{t('Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They\'re the easiest way to get started using the API.')}</p>
          <p>{tct('For more information on how to use the web API, see our [link:documentation].', {
            link: <a href="https://docs.sentry.io/hosted/api/" />
          })}</p>

          <TokenForm
            initialData={{
              scopes: defaultScopes,
            }}
            onCancel={this.onCancel}
            onSave={this.onSave} />

        </NarrowLayout>
      </DocumentTitle>
    );
  }
});

export default ApiNewToken;

