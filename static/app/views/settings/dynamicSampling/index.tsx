import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  hasDynamicSamplingCustomFeature,
  hasDynamicSamplingFeature,
} from 'sentry/utils/dynamicSampling/features';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationSampling} from 'sentry/views/settings/dynamicSampling/organizationSampling';
import {ProjectSampling} from 'sentry/views/settings/dynamicSampling/projectSampling';
import {useHasDynamicSamplingReadAccess} from 'sentry/views/settings/dynamicSampling/utils/access';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

export default function DynamicSamplingSettings() {
  const organization = useOrganization();
  const hasReadAccess = useHasDynamicSamplingReadAccess();

  if (
    hasDynamicSamplingFeature(organization) &&
    !hasDynamicSamplingCustomFeature(organization)
  ) {
    return (
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          {tct(
            'Custom Sample Rates for Dynamic Sampling are not available on your current plan. Check our [documentation] for information about how to set Sampling Priorities.',
            {
              documentation: (
                <ExternalLink href="https://docs.sentry.io/organization/dynamic-sampling/#dynamic-sampling-priorities">
                  {t('documentation')}
                </ExternalLink>
              ),
            }
          )}
        </Alert>
      </Alert.Container>
    );
  }

  if (!hasDynamicSamplingCustomFeature(organization)) {
    return (
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          {tct(
            'Dynamic Sampling is not available on your current plan. Check our [documentation] for more information about Dynamic Sampling.',
            {
              documentation: (
                <ExternalLink href="https://docs.sentry.io/organization/dynamic-sampling/">
                  {t('documentation')}
                </ExternalLink>
              ),
            }
          )}
        </Alert>
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
            <FeatureBadge type="alpha" />
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
      <OrganizationPermissionAlert />
      {hasReadAccess ? (
        <Fragment>
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
      ) : (
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t('You need at least member permissions to view these settings.')}
          </Alert>
        </Alert.Container>
      )}
    </Fragment>
  );
}

const Paragraph = styled('p')`
  margin-bottom: ${space(1.5)};
`;
