import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';

import {removeAndRedirectToRemainingOrganization} from '../../../../actionCreators/organizations';
import {t, tct} from '../../../../locale';
import ApiMixin from '../../../../mixins/apiMixin';
import LinkWithConfirmation from '../../../../components/linkWithConfirmation';
import LoadingIndicator from '../../../../components/loadingIndicator';
import OrganizationStore from '../../../../stores/organizationStore';
import SettingsPageHeader from '../../components/settingsPageHeader';
import getSettingsComponent from '../../../../utils/getSettingsComponent';

const OrganizationGeneralSettingsView = React.createClass({
  propTypes: {
    routes: PropTypes.arrayOf(PropTypes.object),
  },

  mixins: [ApiMixin, Reflux.connect(OrganizationStore, 'organizations')],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: null,
    };
  },

  componentDidMount() {
    let {routes} = this.props;
    let fetchForm = getSettingsComponent(
      () =>
        import(/*webpackChunkName: "organizationSettingsForm"*/ './organizationSettingsForm'),
      () =>
        import(/*webpackChunkName: "organizationSettingsForm.old"*/ './organizationSettingsForm.old'),
      routes
    );
    Promise.all([this.fetchData(), fetchForm]).then(
      ([data, Form]) => {
        this.setState({data, loading: false, Form});
      },
      () => {
        this.setState({error: true, loading: false});
      }
    );
  },

  fetchData() {
    return new Promise((resolve, reject) => {
      this.api.request(`/organizations/${this.props.params.orgId}/`, {
        method: 'GET',
        success: data => {
          resolve(data);
        },
        error: () => {
          reject();
        },
      });
    });
  },

  handleRemoveOrganization() {
    let {data} = this.state || {};
    if (!data) return;

    // Can't remove if this is only org
    let allOrgs = OrganizationStore.getAll();
    if (allOrgs && allOrgs.length < 2) return;

    removeAndRedirectToRemainingOrganization(this.api, {
      orgId: this.props.params.orgId,
      successMessage: `${data.name} is queued for deletion.`,
      errorMessage: `Error removing the ${data && data.name} organization`,
    });
  },

  handleSave(data) {
    // TODO(dcramer): this should propagate
    this.setState({data});

    // Ugh `data` here is different than data in OrganizationStore
    OrganizationStore.add(data);
  },

  render() {
    let {data, organizations} = this.state;
    let orgId = this.props.params.orgId;
    let access = data && new Set(data.access);

    let hasTeams = data && data.teams && !!data.teams.length;
    let hasMultipleOrgs = data && organizations.length > 1;

    return (
      <div>
        {this.state.loading && <LoadingIndicator />}

        {!this.state.loading &&
          this.state.Form && (
            <div>
              <SettingsPageHeader label={t('Organization Settings')} />
              <this.state.Form
                {...this.props}
                initialData={data}
                orgId={orgId}
                access={access}
                onSave={this.handleSave}
              />

              {access.has('org:admin') &&
                !data.isDefault &&
                hasMultipleOrgs && (
                  <div className="box">
                    <div className="box-header">
                      <h3>{t('Remove Organization')}</h3>
                    </div>
                    <div className="box-content with-padding">
                      <p>
                        {t(
                          'Removing this organization will delete all data including projects and their associated events.'
                        )}
                      </p>

                      <fieldset className="form-actions">
                        <LinkWithConfirmation
                          className="btn btn-danger"
                          priority="danger"
                          title={tct('Remove [name] organization', {
                            name: data && data.name,
                          })}
                          message={
                            <div>
                              <p>
                                {tct(
                                  'Removing the [name] organization is permanent and cannot be undone!',
                                  {name: data && data.name}
                                )}
                              </p>

                              {hasTeams && (
                                <div>
                                  <p>
                                    {t(
                                      'This will also remove the following teams and all associated projects:'
                                    )}
                                  </p>
                                  <ul>
                                    {data.teams.map(team => (
                                      <li key={team.slug}>{team.name}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          }
                          onConfirm={this.handleRemoveOrganization}
                        >
                          {t('Remove Organization')}
                        </LinkWithConfirmation>
                      </fieldset>
                    </div>
                  </div>
                )}
            </div>
          )}
      </div>
    );
  },
});

export default OrganizationGeneralSettingsView;
