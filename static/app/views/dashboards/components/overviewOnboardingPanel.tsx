import emptyStateImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import {LinkButton} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';

interface OverviewOnboardingPanelProps {
  description: string;
}

export function OverviewOnboardingPanel({description}: OverviewOnboardingPanelProps) {
  return (
    <Panel>
      <Container padding="xl" overflow="hidden" minHeight={300}>
        <Flex align="center" wrap="wrap-reverse" gap="3xl">
          <Flex direction="column" gap="lg" flex="5">
            <Heading as="h3">{description}</Heading>
            <Text as="p" size="md">
              {t(
                'This dashboard will be populated once your projects start sending relevant telemetry data. Set up your SDK to begin monitoring performance.'
              )}
            </Text>
            <div>
              <LinkButton
                priority="primary"
                external
                href="https://docs.sentry.io/product/dashboards/"
              >
                {t('Read the Docs')}
              </LinkButton>
            </div>
          </Flex>
          <Flex flex="3" justify="center">
            <Image src={emptyStateImg} alt="" width="100%" />
          </Flex>
        </Flex>
      </Container>
    </Panel>
  );
}
