import {Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {addLoadingMessage} from 'sentry/actionCreators/indicator';
import {
  changeOrganizationSlug,
  removeAndRedirectToRemainingOrganization,
  updateOrganization,
} from 'sentry/actionCreators/organizations';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';
import {OrganizationRegionAction} from 'sentry/views/settings/organizationGeneralSettings/organizationRegionAction';

import OrganizationSettingsForm from './organizationSettingsForm';

type Props = {
  organization: Organization;
  projects: Project[];
} & RouteComponentProps<{}, {}>;

function OrganizationGeneralSettings(props: Props) {
  const api = useApi();

  const {organization, projects} = props;
  const access = new Set(organization.access);

  const removeConfirmMessage = (
    <Fragment>
      <TextBlock>
        {tct(
          'Removing the organization, [name] is permanent and cannot be undone! Are you sure you want to continue?',
          {
            name: organization && <strong>{organization.name}</strong>,
          }
        )}
      </TextBlock>

      {!!projects.length && (
        <Fragment>
          <TextBlock>
            {t('This will also remove the following associated projects:')}
          </TextBlock>
          <List symbol="bullet" data-test-id="removed-projects-list">
            {projects.map(project => (
              <ListItem key={project.slug}>{project.slug}</ListItem>
            ))}
          </List>
        </Fragment>
      )}
    </Fragment>
  );

  const handleSaveForm: React.ComponentProps<
    typeof OrganizationSettingsForm
  >['onSave'] = (prevData: Organization, updated: Organization) => {
    if (updated.slug && updated.slug !== prevData.slug) {
      changeOrganizationSlug(prevData, updated);

      if (updated.features.includes('customer-domains')) {
        const {organizationUrl} = updated.links;
        window.location.replace(`${organizationUrl}/settings/organization/`);
      } else {
        browserHistory.replace(`/settings/${updated.slug}/`);
      }
    } else {
      if (prevData.codecovAccess !== updated.codecovAccess) {
        trackAnalytics('organization_settings.codecov_access_updated', {
          organization: updated,
          has_access: updated.codecovAccess,
        });
      }

      // This will update OrganizationStore (as well as OrganizationsStore
      // which is slightly incorrect because it has summaries vs a detailed org)
      updateOrganization(updated);
    }
  };

  const handleConfirmRemoveOrg = () => {
    if (!organization) {
      return;
    }

    addLoadingMessage();
    removeAndRedirectToRemainingOrganization(api, {
      orgId: organization.slug,
      successMessage: `${organization.name} is queued for deletion.`,
      errorMessage: `Error removing the ${organization.name} organization`,
    });
  };

  const organizationRegionInfo = OrganizationRegionAction({
    organization,
  });

  return (
    <Fragment>
      <SentryDocumentTitle title={t('General Settings')} orgSlug={organization.slug} />
      <div>
        <SettingsPageHeader
          title={t('Organization Settings')}
          action={organizationRegionInfo}
        />
        <PermissionAlert />

        <OrganizationSettingsForm initialData={organization} onSave={handleSaveForm} />

        {access.has('org:admin') && !organization.isDefault && (
          <Panel>
            <PanelHeader>{t('Remove Organization')}</PanelHeader>
            <FieldGroup
              label={t('Remove Organization')}
              help={t(
                'Removing this organization will delete all data including projects and their associated events.'
              )}
            >
              <div>
                <Confirm
                  priority="danger"
                  confirmText={t('Remove Organization')}
                  message={removeConfirmMessage}
                  onConfirm={handleConfirmRemoveOrg}
                >
                  <Button priority="danger">{t('Remove Organization')}</Button>
                </Confirm>
              </div>
            </FieldGroup>
          </Panel>
        )}
      </div>
    </Fragment>
  );
}

export default withProjects(withOrganization(OrganizationGeneralSettings));
