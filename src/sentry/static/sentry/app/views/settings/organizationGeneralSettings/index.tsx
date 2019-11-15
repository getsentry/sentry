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
import Field from 'app/views/settings/components/forms/field';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import OrganizationSettingsForm from './organizationSettingsForm';

const OrganizationGeneralSettings = createReactClass({
  displayName: 'OrganizationGeneralSettings',

  propTypes: {
    api: PropTypes.object,
    organization: SentryTypes.Organization.isRequired,
    routes: PropTypes.arrayOf(PropTypes.object),
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: null,
    };
  },

  handleRemoveOrganization() {
    const {data} = this.state || {};
    if (!data) {
      return;
    }

    addLoadingMessage();
    removeAndRedirectToRemainingOrganization(this.props.api, {
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
      // This will update OrganizationStore (as well as OrganizationsStore
      // which is slightly incorrect because it has summaries vs a detailed org)
      updateOrganization(data);
    }
  },

  render() {
    const {organization: data} = this.props;
    const orgId = this.props.params.orgId;
    const access = data && new Set(data.access);

    const hasProjects = data && data.projects && !!data.projects.length;

    return (
      <React.Fragment>
        <SentryDocumentTitle title={t('General Settings')} objSlug={orgId} />
        <div>
          <SettingsPageHeader title={t('Organization Settings')} />
          <OrganizationSettingsForm
            {...this.props}
            initialData={data}
            orgId={orgId}
            access={access}
            onSave={this.handleSave}
          />

          {access.has('org:admin') && !data.isDefault && (
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
      </React.Fragment>
    );
  },
});

export {OrganizationGeneralSettings};

export default withApi(withOrganization(OrganizationGeneralSettings));
