import emptyStateImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import {LinkButton} from '@sentry/scraps/button';
import {CodeBlock, InlineCode} from '@sentry/scraps/code';
import {Image} from '@sentry/scraps/image';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {t, tct} from 'sentry/locale';

const DOCS_URL = 'https://docs.sentry.io/platforms/elixir/metrics/';

const DEPS_SNIPPET = `# mix.exs
defp deps do
  [
    # ...
    {:telemetry_poller, "~> 1.0"}
  ]
end`;

const CONFIG_SNIPPET = `# config/config.exs
config :sentry,
  dsn: "__YOUR_DSN__",
  metrics: [runtime: [enabled: true]]`;

export function ElixirRuntimeMetricsOnboarding() {
  return (
    <Panel>
      <Flex justify="center">
        <Flex padding="xl" align="center" wrap="wrap-reverse" gap="3xl" maxWidth="1000px">
          <Stack gap="xl" flex="5" align="start">
            <Heading as="h3" size="xl">
              {t('Monitor Elixir Runtime Metrics')}
            </Heading>

            <Text as="p" size="md">
              {t(
                'Track scheduler utilization, memory usage, run queues, and process, atom, and port counts for your BEAM nodes. Enable runtime metrics in the Sentry Elixir SDK to start collecting data.'
              )}
            </Text>

            <Text as="p" size="md">
              {tct('Add [pkg] to your dependencies:', {
                pkg: <InlineCode>telemetry_poller</InlineCode>,
              })}
            </Text>

            <CodeBlock language="elixir">{DEPS_SNIPPET}</CodeBlock>

            <Text as="p" size="md">
              {t('Then enable runtime metrics in your Sentry configuration:')}
            </Text>

            <CodeBlock language="elixir">{CONFIG_SNIPPET}</CodeBlock>

            <Text as="p" size="sm" variant="muted">
              {t(
                'Data appears after the first telemetry_poller interval (default 5 seconds).'
              )}
            </Text>

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
