import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge/featureBadge';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {DataForwarderOnboarding} from 'sentry/views/settings/organizationDataForwarding/components/dataForwarderOnboarding';
import {DataForwarderRow} from 'sentry/views/settings/organizationDataForwarding/components/dataForwarderRow';
import {useDataForwarders} from 'sentry/views/settings/organizationDataForwarding/util/hooks';
import {
  DATA_FORWARDING_FEATURES,
  DataForwarderProviderSlug,
} from 'sentry/views/settings/organizationDataForwarding/util/types';

export default function OrganizationDataForwarding() {
  const organization = useOrganization();
  const {
    data: dataForwarders = [],
    isLoading,
    isError,
  } = useDataForwarders({
    params: {orgSlug: organization.slug},
  });
  const canCreateForwarder =
    dataForwarders.length < Object.values(DataForwarderProviderSlug).length;

  const pageContent = (
    <Feature
      features={DATA_FORWARDING_FEATURES}
      hookName="feature-disabled:data-forwarding"
    >
      {({hasFeature, features}) => (
        <Fragment>
          {!hasFeature && (
            <FeatureDisabled
              alert
              featureName={t('Data Forwarding')}
              features={features}
            />
          )}
          {dataForwarders.length > 0 ? (
            <Fragment>
              <Stack gap="xl">
                {dataForwarders.map(df => (
                  <DataForwarderRow
                    key={df.id}
                    dataForwarder={df}
                    disabled={!hasFeature}
                  />
                ))}
              </Stack>
              <Flex justify="end">
                <Access access={['org:write']}>
                  <LinkButton
                    priority="primary"
                    to={`/settings/${organization.slug}/data-forwarding/setup/`}
                    icon={<IconAdd />}
                    size="sm"
                    onClick={() => {
                      trackAnalytics('data_forwarding.add_forwarder_clicked', {
                        organization,
                      });
                    }}
                    disabled={!canCreateForwarder || !hasFeature}
                    title={
                      canCreateForwarder || !hasFeature
                        ? undefined
                        : t('Maximum data forwarders configured.')
                    }
                  >
                    {t('Setup a new Forwarder')}
                  </LinkButton>
                </Access>
              </Flex>
            </Fragment>
          ) : (
            <DataForwarderOnboarding disabled={!hasFeature} />
          )}
        </Fragment>
      )}
    </Feature>
  );

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Data Forwarding')} />
      <Flex direction="column" gap="lg">
        <Flex align="center" justify="between" gap="2xl">
          <Flex direction="column" gap="sm">
            <Flex align="center" gap="lg">
              <Heading as="h1">{t('Data Forwarding')}</Heading>
              <FeatureBadge type="beta" />
            </Flex>
            <Text variant="muted">
              {tct(
                'Pipe your Sentry error events into other business intelligence tools. Learn more about this feature in our [link:docs].',
                {
                  link: (
                    <ExternalLink
                      href="https://docs.sentry.io/organization/integrations/data-forwarding/"
                      onClick={() => {
                        trackAnalytics('data_forwarding.docs_link_clicked', {
                          organization,
                        });
                      }}
                    />
                  ),
                }
              )}
            </Text>
          </Flex>
        </Flex>
        {isLoading ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError message={t('Failed to load data forwarders')} />
        ) : (
          pageContent
        )}
      </Flex>
    </Fragment>
  );
}
