import {Component, Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {addLoadingMessage} from 'app/actionCreators/indicator';
import {
  changeOrganizationSlug,
  removeAndRedirectToRemainingOrganization,
  updateOrganization,
} from 'app/actionCreators/organizations';
import {Client} from 'app/api';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {Panel, PanelHeader} from 'app/components/panels';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t, tct} from 'app/locale';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import Field from 'app/views/settings/components/forms/field';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';

import OrganizationSettingsForm from './organizationSettingsForm';

type Props = {
  api: Client;
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

class OrganizationGeneralSettings extends Component<Props> {
  handleRemoveOrganization = () => {
    const {api, organization, params} = this.props;
    if (!organization) {
      return;
    }

    addLoadingMessage();
    removeAndRedirectToRemainingOrganization(api, {
      orgId: params.orgId,
      successMessage: `${organization.name} is queued for deletion.`,
      errorMessage: `Error removing the ${organization.name} organization`,
    });
  };

  handleSave = (prevData: Organization, data: Partial<Organization>) => {
    if (data.slug && data.slug !== prevData.slug) {
      changeOrganizationSlug(
        prevData,
        data as Partial<Organization> & Pick<Organization, 'slug'>
      );
      browserHistory.replace(`/settings/${data.slug}/`);
    } else {
      // This will update OrganizationStore (as well as OrganizationsStore
      // which is slightly incorrect because it has summaries vs a detailed org)
      updateOrganization(data);
    }
  };

  render() {
    const {organization, params} = this.props;
    const {orgId} = params;
    const access = new Set(organization.access);
    const hasProjects = organization.projects && !!organization.projects.length;

    return (
      <Fragment>
        <SentryDocumentTitle title={t('General Settings')} orgSlug={orgId} />
        <div>
          <SettingsPageHeader title={t('Organization Settings')} />
          <PermissionAlert />

          <OrganizationSettingsForm
            {...this.props}
            initialData={organization}
            access={access}
            onSave={this.handleSave}
          />

          {access.has('org:admin') && !organization.isDefault && (
            <Panel>
              <PanelHeader>{t('Remove Organization')}</PanelHeader>
              <Field
                label={t('Remove Organization')}
                help={t(
                  'Removing this organization will delete all data including projects and their associated events.'
                )}
              >
                <div>
                  <Confirm
                    priority="danger"
                    confirmText={t('Remove Organization')}
                    message={
                      <div>
                        <TextBlock>
                          {tct(
                            'Removing the organization, [name] is permanent and cannot be undone! Are you sure you want to continue?',
                            {
                              name: organization && <strong>{organization.name}</strong>,
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
                              {organization.projects.map(project => (
                                <li key={project.slug}>{project.slug}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    }
                    onConfirm={this.handleRemoveOrganization}
                  >
                    <Button
                      priority="danger"
                      title={t(
                        'Remove %s organization',
                        organization && organization.name
                      )}
                    >
                      {t('Remove Organization')}
                    </Button>
                  </Confirm>
                </div>
              </Field>
            </Panel>
          )}
        </div>
      </Fragment>
    );
  }
}

export default withApi(withOrganization(OrganizationGeneralSettings));
