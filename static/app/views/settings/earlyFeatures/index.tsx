import {Fragment} from 'react';
import {useStore} from 'zustand';

import {FeatureBadge} from '@sentry/scraps/badge';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {EarlyFeaturesSettingsForm} from 'sentry/views/settings/earlyFeatures/settingsForm';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

export default function OrganizationGeneralSettings() {
  const isSelfHosted = useStore(ConfigStore, state => state.isSelfHosted);
  const organization = useOrganization();

  const access = new Set(organization.access);
  if (!isSelfHosted) {
    return null;
  }
  return (
    <Fragment>
      <SentryDocumentTitle title={t('General Settings')} orgSlug={organization.slug} />
      <div>
        <SettingsPageHeader
          title={{
            type: 'page-title',
            label: t('Early Features'),
            trailingActions: {type: 'badge', element: <FeatureBadge type="new" />},
          }}
        />
        <OrganizationPermissionAlert />

        <EarlyFeaturesSettingsForm access={access} />
      </div>
    </Fragment>
  );
}
