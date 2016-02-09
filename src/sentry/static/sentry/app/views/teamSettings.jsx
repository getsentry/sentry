import jQuery from 'jquery';
import React from 'react';
import {History} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import ConfigStore from '../stores/configStore';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import OrganizationState from '../mixins/organizationState';
import {TextField} from '../components/forms';
import {t} from '../locale';

const FormState = {
  READY: 'Ready',
  SAVING: 'Saving',
  ERROR: 'Error',
};

const TeamSettingsForm = React.createClass({
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
  contextTypes: {
    location: React.PropTypes.object
  },

  mixins: [
    ApiMixin,
    History,
    OrganizationState
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      team: null
    };
  },

  componentWillMount() {
    this.fetchData();
    jQuery(document.body).addClass('narrow');
  },

  componentWillReceiveProps(nextProps) {
    let params = this.props.params;
    if (nextProps.params.teamId !== params.teamId ||
        nextProps.params.orgId !== params.orgId) {
      this.setState({
        loading: true,
        error: false
      }, this.fetchData);
    }
  },

  componentWillUnmount() {
    jQuery(document.body).removeClass('narrow');
  },

  fetchData() {
    let params = this.props.params;

    this.api.request(`/teams/${params.orgId}/${params.teamId}/`, {
      success: (data) => {
        this.setState({
          team: data,
          loading: false,
          error: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  onSaveTeam(data) {
    let team = this.state.team;
    if (data.slug !== team.slug) {
      let orgId = this.props.params.orgId;
      this.history.pushState(null, `/organizations/${orgId}/teams/${data.slug}/settings/`);
    } else {
      Object.assign({}, team, data);
      this.setState({team: team});
    }
  },

  render() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let {orgId, teamId} = this.props.params;
    let team = this.state.team;
    let urlPrefix = ConfigStore.get('urlPrefix');
    let access = this.getAccess();

    return (
      <div className="container">
        <h3>{team.name} <small>{t('Team Settings')}</small></h3>

        <div className="box">
          <div className="box-content with-padding">
            <TeamSettingsForm
              orgId={orgId}
              teamId={teamId}
              initialData={team}
              onSave={this.onSaveTeam} />
          </div>
        </div>

        {access.has('team:delete') &&
          <div className="box">
            <div className="box-header">
              <h3>{t('Remove Team')}</h3>
            </div>
            <div className="box-content with-padding">
              <p>{t('Removing this team will delete associated projects and events.')}</p>

              <fieldset className="form-actions">
                <a href={`${urlPrefix}/organizations/${orgId}/teams/${teamId}/remove/`} className="btn btn-danger">
                  {t('Remove Team')}
                </a>
              </fieldset>
            </div>
          </div>
        }
      </div>
    );
  }
});

export default TeamSettings;
