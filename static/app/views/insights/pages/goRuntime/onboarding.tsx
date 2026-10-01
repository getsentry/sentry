import emptyStateImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import {LinkButton} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';

export function GoRuntimeMetricsOnboarding() {
  return (
    <Panel>
      <Flex justify="center">
        <Flex padding="xl" align="center" wrap="wrap-reverse" gap="3xl" maxWidth="1000px">
          <Stack gap="xl" flex="5" align="start">
            <Heading as="h3" size="xl">
              {t('Monitor Go Runtime Metrics')}
            </Heading>

            <Text as="p" size="md">
              {t(
                'Investigate slow traces with CPU utilization, GC CPU usage, runtime memory, live heap memory, goroutine count, and scheduler delay.'
              )}
            </Text>

            <Text as="p" size="md">
              {t(
                'Runtime collection is off by default. Enable the Go runtime collector to collect these six gauges. You can disable individual metrics without changing the defaults for the others.'
              )}
            </Text>

            <Text as="p" size="md">
              {t(
                'Memory limit, heap goal, and GC pause p99 are optional signals and are disabled by default. Their charts remain empty until data is received. Memory limit is only reported when configured.'
              )}
            </Text>

            <Text as="p" size="sm" variant="muted">
              {t(
                'The default collection interval is 30 seconds. Some metrics need baseline samples before they appear. Disabled or unavailable metrics do not send data.'
              )}
            </Text>

            <LinkButton
              variant="primary"
              external
              href="https://docs.sentry.io/platforms/go/"
            >
              {t('Read the Docs')}
            </LinkButton>
          </Stack>

          <Flex flex="3" justify="center">
            <Image src={emptyStateImg} alt="" width="100%" />
          </Flex>
        </Flex>
      </Flex>
    </Panel>
  );
}
