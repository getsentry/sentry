import PropTypes from 'prop-types';
import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import IndicatorStore from '../../stores/indicatorStore';
import ProjectState from '../../mixins/projectState';
import {FormState, TextareaField} from '../../components/forms';
import {t} from '../../locale';

const ProjectFiltersSettingsForm = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    initialData: PropTypes.object.isRequired
  },

  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    let formData = {};
    let features = this.getProjectFeatures();
    for (let key of Object.keys(this.props.initialData)) {
      if (key.lastIndexOf('filters:') === 0) {
        // the project details endpoint can partially succeed and still return a 400
        // if the org does not have the additional-data-filters feature enabled,
        // so this prevents the form from sending an empty string by default
        if (
          (!features.has('additional-data-filters') &&
            key === 'filters:error_messages') ||
          key === 'filters:releases'
        )
          continue;
        formData[key] = this.props.initialData[key];
      }
    }
    return {
      hasChanged: false,
      formData,
      errors: {}
    };
  },

  onFieldChange(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({
      formData: {...formData},
      hasChanged: true
    });
  },

  onSubmit(e) {
    e.preventDefault();
    if (this.state.state === FormState.SAVING) {
      return;
    }
    this.setState(
      {
        state: FormState.SAVING
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        let {orgId, projectId} = this.props;
        this.api.request(`/projects/${orgId}/${projectId}/`, {
          method: 'PUT',
          data: {options: this.state.formData},
          success: data => {
            this.setState({
              state: FormState.READY,
              errors: {},
              hasChanged: false
            });
          },
          error: error => {
            this.setState({
              state: FormState.ERROR,
              errors: error.responseJSON
            });
          },
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          }
        });
      }
    );
  },

  renderLinkToGlobWiki() {
    return (
      <span>
        {t('Separate multiple entries with a newline. Allows ')}
        <a href="https://en.wikipedia.org/wiki/Glob_(programming)">
          {t('glob pattern matching.')}
        </a>
      </span>
    );
  },

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let errors = this.state.errors;
    let features = this.getProjectFeatures();

    return (
      <form onSubmit={this.onSubmit} className="form-stacked p-b-1">
        {this.state.state === FormState.ERROR &&
          <div className="alert alert-error alert-block">
            {t(
              'Unable to save your changes. Please ensure all fields are valid and try again.'
            )}
          </div>}
        <fieldset>
          <h5>{t('Filter errors from these IP addresses:')}</h5>
          <TextareaField
            key="ip"
            name="ip"
            help={t('Separate multiple entries with a newline.')}
            placeholder="e.g. 127.0.0.1 or 10.0.0.0/8"
            value={this.state.formData['filters:blacklisted_ips']}
            error={errors['filters:blacklisted_ips']}
            onChange={this.onFieldChange.bind(this, 'filters:blacklisted_ips')}
          />
          {features.has('additional-data-filters') &&
            <div>
              <h5>{t('Filter errors from these releases:')}</h5>
              <TextareaField
                key="release"
                name="release"
                help={this.renderLinkToGlobWiki()}
                placeholder="e.g. 1.* or [!3].[0-9].*"
                value={this.state.formData['filters:releases']}
                error={errors['filters:releases']}
                onChange={this.onFieldChange.bind(this, 'filters:releases')}
              />
              <h5>{t('Filter errors by error message:')}</h5>
              <TextareaField
                key="errorMessage"
                name="errorMessage"
                help={this.renderLinkToGlobWiki()}
                placeholder="e.g. TypeError* or *: integer division or modulo by zero"
                value={this.state.formData['filters:error_messages']}
                error={errors['filters:error_messages']}
                onChange={this.onFieldChange.bind(this, 'filters:error_messages')}
              />
            </div>}
          <div className="pull-right">
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={isSaving || !this.state.hasChanged}>
              {t('Save Changes')}
            </button>

          </div>
        </fieldset>
      </form>
    );
  }
});
export default ProjectFiltersSettingsForm;
