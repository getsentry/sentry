import emptyStateImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import {LinkButton} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';

interface OverviewOnboardingPanelProps {
  heading: string;
}

export function GenericOnboarding({heading}: OverviewOnboardingPanelProps) {
  return (
    <Panel>
      <Flex justify="center">
        <Flex padding="xl" align="center" wrap="wrap-reverse" gap="3xl" maxWidth="1000px">
          <Flex direction="column" gap="xl" flex="5" align="start">
            <Heading as="h3" size="xl">
              {heading}
            </Heading>

            <Text as="p" size="md">
              {t(
                'Send telemetry data to Sentry for this project to start using this dashboard. Set up your SDK to begin monitoring your application.'
              )}
            </Text>

            <LinkButton
              priority="primary"
              external
              href="https://docs.sentry.io/product/dashboards/"
            >
              {t('Read the Docs')}
            </LinkButton>
          </Flex>

          <Flex flex="3" justify="center">
            <Image src={emptyStateImg} alt="" width="100%" />
          </Flex>
        </Flex>
      </Flex>
    </Panel>
  );
}
