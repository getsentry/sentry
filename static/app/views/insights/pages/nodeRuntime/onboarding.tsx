import emptyStateImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import {LinkButton} from '@sentry/scraps/button';
import {CodeBlock, InlineCode} from '@sentry/scraps/code';
import {Image} from '@sentry/scraps/image';
import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {t, tct} from 'sentry/locale';

const DOCS_URL =
  'https://docs.sentry.io/platforms/javascript/guides/node/configuration/integrations/noderuntimemetrics/';

const CODE_SNIPPET = `import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: '__YOUR_DSN__',
  integrations: [Sentry.nodeRuntimeMetricsIntegration()],
});`;

export function NodeRuntimeMetricsOnboarding() {
  return (
    <Panel>
      <Flex justify="center">
        <Flex padding="xl" align="center" wrap="wrap-reverse" gap="3xl" maxWidth="1000px">
          <Flex direction="column" gap="xl" flex="5" align="start">
            <Heading as="h3" size="xl">
              {t('Monitor Node.js Runtime Metrics')}
            </Heading>

            <Text as="p" size="md">
              {t(
                'Track CPU utilization, memory usage, and event loop health for your Node.js processes. Enable the runtime metrics integration to start collecting data.'
              )}
            </Text>

            <Text as="p" size="md">
              {tct('Requires [pkg] or later.', {
                pkg: <InlineCode>@sentry/node 10.47.0</InlineCode>,
              })}
            </Text>

            <CodeBlock language="javascript">{CODE_SNIPPET}</CodeBlock>

            <Text as="p" size="sm" variant="muted">
              {t(
                'Data appears after the first collection interval (default 30 seconds).'
              )}
            </Text>

            <LinkButton variant="primary" external href={DOCS_URL}>
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
