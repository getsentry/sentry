import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge/featureBadge';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {DataForwarderOnboarding} from 'sentry/views/settings/organizationDataForwarding/components/dataForwarderOnboarding';
import {DataForwarderRow} from 'sentry/views/settings/organizationDataForwarding/components/dataForwarderRow';
import {useDataForwarders} from 'sentry/views/settings/organizationDataForwarding/util/hooks';

export default function OrganizationDataForwarding() {
  const organization = useOrganization();
  const {data: dataForwarders} = useDataForwarders({
    params: {orgSlug: organization.slug},
  });

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
        {dataForwarders && dataForwarders.length > 0 ? (
          <Fragment>
            <Stack gap="xl">
              {dataForwarders.map(df => (
                <DataForwarderRow key={df.id} dataForwarder={df} />
              ))}
            </Stack>
            <Flex justify="end">
              <LinkButton
                priority="primary"
                to={`/settings/${organization.slug}/data-forwarding/setup/`}
                icon={<IconAdd />}
                size="sm"
                onClick={() => {
                  trackAnalytics('data_forwarding.add_forwarder_clicked', {organization});
                }}
              >
                {t('Setup a new Forwarder')}
              </LinkButton>
            </Flex>
          </Fragment>
        ) : (
          <DataForwarderOnboarding />
        )}
      </Flex>
    </Fragment>
  );
}
