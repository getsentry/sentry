import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationSampling} from 'sentry/views/settings/dynamicSampling/organizationSampling';

export default function DynamicSamplingSettings() {
  const organization = useOrganization();

  if (!hasDynamicSamplingCustomFeature(organization)) {
    return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Dynamic Sampling')} orgSlug={organization.slug} />
      <div>
        <SettingsPageHeader title={t('Dynamic Sampling')} />
        <OrganizationSampling />
      </div>
    </Fragment>
  );
}
