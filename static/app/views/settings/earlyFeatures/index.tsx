import {Fragment} from 'react';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import EarlyFeaturesSettingsForm from 'sentry/views/settings/earlyFeatures/settingsForm';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

export default function OrganizationGeneralSettings(props: RouteComponentProps) {
  const {isSelfHosted} = useLegacyStore(ConfigStore);
  const organization = useOrganization();

  const access = new Set(organization.access);
  if (!isSelfHosted) {
    return null;
  }
  return (
    <Fragment>
      <SentryDocumentTitle title={t('General Settings')} orgSlug={organization.slug} />
      <div>
        <SettingsPageHeader title={t('Early Features')} />
        <OrganizationPermissionAlert />

        <EarlyFeaturesSettingsForm {...props} access={access} />
      </div>
    </Fragment>
  );
}
