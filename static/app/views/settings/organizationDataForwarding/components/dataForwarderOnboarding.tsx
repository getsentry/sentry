import styled from '@emotion/styled';

import tracingTelescopeImg from 'sentry-images/spot/tracing-telescope.svg';

import {Image} from '@sentry/scraps/image/image';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import Access from 'sentry/components/acl/access';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export function DataForwarderOnboarding({disabled}: {disabled: boolean}) {
  const organization = useOrganization();

  return (
    <Container border="primary" radius="md" padding="2xl">
      <Flex direction="row" align="center">
        <Flex direction="column" gap="xl" maxWidth="600px" flex={3} align="start">
          <Heading as="h2">{t('Keep your data pipeline flowing.')}</Heading>
          <Text variant="muted" size="lg">
            {t(
              'Stream your Sentry errors to the data warehouse your team already uses—without writing a single line of code.'
            )}
          </Text>
          <Text variant="muted" size="lg">
            {t('Works with Amazon SQS, Segment and Splunk.')}
          </Text>
          <Access access={['org:write']}>
            <LinkButton
              priority="primary"
              to={`/settings/${organization.slug}/data-forwarding/setup/`}
              onClick={() => {
                trackAnalytics('data_forwarding.onboarding_cta_clicked', {organization});
              }}
              disabled={disabled}
            >
              {t('Setup Your First Forwarder')}
            </LinkButton>
          </Access>
        </Flex>
        <OversizedImage
          src={tracingTelescopeImg}
          alt={t('Data jumps between planets, sentry tracks it with a telescope')}
        />
      </Flex>
    </Container>
  );
}

const OversizedImage = styled(Image)`
  transform: translateX(8%) scale(1.1);
  flex: 2;
`;
