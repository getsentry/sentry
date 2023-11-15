import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import EarlyFeaturesSettingsForm from 'sentry/views/settings/earlyFeatures/settingsForm';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

type Props = {
  organization: Organization;
  projects: Project[];
} & RouteComponentProps<{}, {}>;

function OrganizationGeneralSettings(props: Props) {
  const {organization} = props;
  const access = new Set(organization.access);

  return (
    <Fragment>
      <SentryDocumentTitle title={t('General Settings')} orgSlug={organization.slug} />
      <div>
        <SettingsPageHeader title={t('Early Features')} />
        <PermissionAlert />

        <EarlyFeaturesSettingsForm {...props} access={access} />
      </div>
    </Fragment>
  );
}

export default withProjects(withOrganization(OrganizationGeneralSettings));
