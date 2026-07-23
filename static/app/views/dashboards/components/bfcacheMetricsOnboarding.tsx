import emptyStateImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import {LinkButton} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {Image} from '@sentry/scraps/image';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';

// TODO(bfcache): point at the real docs page once it is published.
const DOCS_URL =
  'https://docs.sentry.io/platforms/javascript/configuration/integrations/bfcachemetrics/';

const CODE_SNIPPET = `import * as Sentry from '@sentry/browser';

Sentry.init({
  dsn: '__YOUR_DSN__',
  integrations: [Sentry.bfcacheMetricsIntegration()],
});`;

export function BfcacheMetricsOnboarding() {
  return (
    <Panel>
      <Flex justify="center">
        <Flex padding="xl" align="center" wrap="wrap-reverse" gap="3xl" maxWidth="1000px">
          <Stack gap="xl" flex="5" align="start">
            <Heading as="h3" size="xl">
              {t('Monitor Back/Forward Cache')}
            </Heading>

            <Text as="p" size="md">
              {t(
                'Track how often the browser back/forward cache (bfcache) restores your pages, why restores are blocked, and how long miss reloads take. Enable the bfcache metrics integration to start collecting data.'
              )}
            </Text>

            <CodeBlock language="javascript">{CODE_SNIPPET}</CodeBlock>

            <LinkButton variant="primary" external href={DOCS_URL}>
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
