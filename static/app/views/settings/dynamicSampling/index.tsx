import {Fragment} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {LinkButton} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
    return (
      <Alert.Container>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Alert.Container>
    );
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Dynamic Sampling')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={
          <Fragment>
            {t('Dynamic Sampling')}
            <FeatureBadge type="new" />
          </Fragment>
        }
        action={
          <LinkButton
            external
            href="https://docs.sentry.io/organization/dynamic-sampling/"
          >
            {t('Read the docs')}
          </LinkButton>
        }
      />
      {!hasWriteAccess && (
        <Alert.Container>
          <Alert type="warning">
            {t(
              'These settings can only be edited by users with the organization owner or manager role.'
            )}
          </Alert>
        </Alert.Container>
      )}
      <Paragraph>
        {t(
          'Dynamic Sampling lets you manage span storage in Sentry. This prioritizes important events and increases visibility into lower-volume projects, keeping the most relevant data while minimizing redundancy. You can customize sample rates and priorities in the settings to control which data is retained.'
        )}
      </Paragraph>
      {organization.samplingMode === 'organization' ? (
        <OrganizationSampling />
      ) : (
        <ProjectSampling />
      )}
    </Fragment>
  );
}

const Paragraph = styled('p')`
  margin-bottom: ${space(1.5)};
`;
