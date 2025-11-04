import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge/featureBadge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Hovercard} from 'sentry/components/hovercard';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {useHasDataForwardingAccess} from 'sentry/views/settings/organizationDataForwarding/hooks';

export default function OrganizationDataForwarding() {
  return (
    <Fragment>
      <SentryDocumentTitle title={t('Data Forwarding')} />
      <Container>
        <Flex align="center" justify="between" gap="xl">
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
                    <ExternalLink href="https://docs.sentry.io/organization/integrations/data-forwarding/" />
                  ),
                }
              )}
            </Text>
          </Flex>
          <DataForwardingSetupButton />
        </Flex>
      </Container>
    </Fragment>
  );
}

function DataForwardingSetupButton() {
  const hasAccess = useHasDataForwardingAccess();
  return hasAccess ? (
    <Button priority="primary">{t('Start Setup')}</Button>
  ) : (
    <Hovercard
      body={
        <FeatureDisabled
          features={['data-forwarding-revamp-access', 'data-forwarding']}
          featureName={t('Data Forwarding')}
          hideHelpToggle
        />
      }
    >
      <Button priority="primary" disabled>
        {t('Start Setup')}
      </Button>
    </Hovercard>
  );
}
