import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
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
  const {isSelfHosted} = useLegacyStore(ConfigStore);
  const {organization} = props;
  const access = new Set(organization.access);
  if (!isSelfHosted) {
    return null;
  }
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
