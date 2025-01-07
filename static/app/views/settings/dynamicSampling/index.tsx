import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {LinkButton} from 'sentry/components/button';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationSampling} from 'sentry/views/settings/dynamicSampling/organizationSampling';
import {ProjectSampling} from 'sentry/views/settings/dynamicSampling/projectSampling';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';

export default function DynamicSamplingSettings() {
  const organization = useOrganization();
  const hasWriteAccess = useHasDynamicSamplingWriteAccess();

  if (!hasDynamicSamplingCustomFeature(organization)) {
    return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Dynamic Sampling')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={
          <Fragment>
            {t('Dynamic Sampling')}
            <FeatureBadge type="alpha" />
          </Fragment>
        }
        action={
          <LinkButton
            external
            href="https://docs.sentry.io/product/performance/retention-priorities/"
          >
            {t('Read the docs')}
          </LinkButton>
        }
      />
      {!hasWriteAccess && (
        <Alert type="warning">
          {t(
            'These settings can only be edited by users with the organization owner or manager role.'
          )}
        </Alert>
      )}
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
    </Fragment>
  );
}
