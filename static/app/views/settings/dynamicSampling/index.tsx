import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationSampling} from 'sentry/views/settings/dynamicSampling/organizationSampling';
import {ProjectSampling} from 'sentry/views/settings/dynamicSampling/projectSampling';

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
        <p>
          {t(
            'Dynamic sampling allows you to send more traces within your budget by retaining the most relevant traces and reducing redundant data. Additionally, it ensures that high-level metrics and insights remain accurate. With these settings you can customize and fine-tune the sampling behavior to prioritize what matters most.'
          )}
        </p>
        {organization.samplingMode === 'organization' ? (
          <OrganizationSampling />
        ) : (
          <ProjectSampling />
        )}
      </div>
    </Fragment>
  );
}
