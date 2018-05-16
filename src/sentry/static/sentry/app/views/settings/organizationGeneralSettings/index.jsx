import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {Panel, PanelHeader} from 'app/components/panels';
import {addLoadingMessage} from 'app/actionCreators/indicator';
import {
  changeOrganizationSlug,
  removeAndRedirectToRemainingOrganization,
  updateOrganization,
} from 'app/actionCreators/organizations';
import {t, tct} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import Field from 'app/views/settings/components/forms/field';
import LinkWithConfirmation from 'app/components/linkWithConfirmation';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import recreateRoute from 'app/utils/recreateRoute';

import OrganizationSettingsForm from './organizationSettingsForm';

const OrganizationGeneralSettings = createReactClass({
  displayName: 'OrganizationGeneralSettings',

  propTypes: {
    routes: PropTypes.arrayOf(PropTypes.object),
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: null,
    };
  },

  componentDidMount() {
    Promise.all([this.fetchData()]).then(
      ([data]) => {
        // Redirect if can't write to org
        if (
          data &&
          data.access.indexOf('org:admin') === -1 &&
          data.access.indexOf('org:write') === -1
        ) {
          browserHistory.replace(
            recreateRoute('teams', {
              params: this.props.params,
              routes: this.props.routes,
              stepBack: -1,
            })
          );
          return;
        }

        this.setState({data, loading: false});
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

    addLoadingMessage();
    removeAndRedirectToRemainingOrganization(this.api, {
      orgId: this.props.params.orgId,
      successMessage: `${data.name} is queued for deletion.`,
      errorMessage: `Error removing the ${data && data.name} organization`,
    });
  },

  handleSave(prevData, data) {
    if (data.slug && data.slug !== prevData.slug) {
      changeOrganizationSlug(prevData, data);
      browserHistory.replace(`/settings/${data.slug}/`);
    } else {
      // TODO(dcramer): this should propagate
      this.setState({data});
      // Ugh `data` here is different than data in OrganizationsStore
      updateOrganization(data);
    }
  },

  render() {
    let {data, loading, error} = this.state;
    let orgId = this.props.params.orgId;
    let access = data && new Set(data.access);

    let hasProjects = data && data.projects && !!data.projects.length;

    return (
      <div>
        {error && <LoadingError />}
        {loading && !error && <LoadingIndicator />}

        {data &&
          !loading &&
          !error && (
            <div>
              <SettingsPageHeader title={t('Organization Settings')} />
              <OrganizationSettingsForm
                {...this.props}
                initialData={data}
                orgId={orgId}
                access={access}
                onSave={this.handleSave}
              />

              {access.has('org:admin') &&
                !data.isDefault && (
                  <Panel>
                    <PanelHeader>{t('Remove Organization')}</PanelHeader>
                    <Field
                      label={t('Remove Organization')}
                      help={t(
                        'Removing this organization will delete all data including projects and their associated events.'
                      )}
                    >
                      <div>
                        <LinkWithConfirmation
                          className="btn btn-danger"
                          priority="danger"
                          size="small"
                          title={t('Remove %s organization', data && data.name)}
                          message={
                            <div>
                              <TextBlock>
                                {tct(
                                  'Removing the organization, [name] is permanent and cannot be undone! Are you sure you want to continue?',
                                  {
                                    name: data && <strong>{data.name}</strong>,
                                  }
                                )}
                              </TextBlock>

                              {hasProjects && (
                                <div>
                                  <TextBlock noMargin>
                                    {t(
                                      'This will also remove the following associated projects:'
                                    )}
                                  </TextBlock>
                                  <ul className="ref-projects">
                                    {data.projects.map(project => (
                                      <li key={project.slug}>{project.slug}</li>
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
                      </div>
                    </Field>
                  </Panel>
                )}
            </div>
          )}
      </div>
    );
  },
});

export default OrganizationGeneralSettings;
