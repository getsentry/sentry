import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
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
        <SettingsPageHeader
          title={t('Dynamic Sampling')}
          action={
            <LinkButton
              external
              href="https://docs.sentry.io/product/performance/retention-priorities/"
            >
              {t('Read the docs')}
            </LinkButton>
          }
        />
        <p>
          {t(
            'Dynamic sampling adaptively reduces the number of spans stored in Sentry without changing SDK sample rates. It allows you to keep the most relevant samples and obtain accurate high-level insights while limiting redundancy and stored span volume. You can customize sample rates and priorities in these settings to control which data is stored.'
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
