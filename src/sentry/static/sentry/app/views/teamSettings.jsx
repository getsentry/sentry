import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import {FormState, TextField} from '../components/forms';
import {t} from '../locale';

const TeamSettingsForm = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    teamId: React.PropTypes.string.isRequired,
    initialData: React.PropTypes.object,
    onSave: React.PropTypes.func.isRequired
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
      let {orgId, teamId} = this.props;
      this.api.request(`/teams/${orgId}/${teamId}/`, {
        method: 'PUT',
        data: this.state.formData,
        success: (data) => {
          this.props.onSave(data);
          this.setState({
            state: FormState.READY,
            errors: {},
          });
        },
        error: (error) => {
          this.setState({
            state: FormState.ERROR,
            errors: error.responseJSON,
          });
        },
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let errors = this.state.errors;
    return (
      <form onSubmit={this.onSubmit} className="form-stacked">
        {this.state.state === FormState.ERROR &&
          <div className="alert alert-error alert-block">
            {t('Unable to save your changes. Please ensure all fields are valid and try again.')}
          </div>
        }
        <fieldset>
          <TextField
            key="name"
            label={t('Name')}
            placeholder={t('e.g. API Team')}
            value={this.state.formData.name}
            required={true}
            error={errors.name}
            onChange={this.onFieldChange.bind(this, 'name')} />
          <TextField
            key="slug"
            label={t('Short name')}
            value={this.state.formData.slug}
            required={true}
            error={errors.slug}
            onChange={this.onFieldChange.bind(this, 'slug')} />
       </fieldset>
        <fieldset className="form-actions">
          <button type="submit" className="btn btn-primary"
                  disabled={isSaving}>{t('Save Changes')}</button>
        </fieldset>
      </form>
    );
  }
});

const TeamSettings = React.createClass({
  propTypes: {
    team: React.PropTypes.object.isRequired,
    onTeamChange: React.PropTypes.func.isRequired
  },

  render() {
    let {orgId, teamId} = this.props.params;
    let team = this.props.team;

    return (
      <div>
        <div className="box">
          <div className="box-content with-padding">
            <TeamSettingsForm
              orgId={orgId}
              teamId={teamId}
              initialData={team}
              onSave={this.props.onTeamChange} />
          </div>
        </div>
      </div>
    );
  }
});

export default TeamSettings;
