import styled from '@emotion/styled';
import {z} from 'zod';

import {CodeBlock} from '@sentry/scraps/code';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {InputCopyButton} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {selectText} from 'sentry/utils/selectText';
import {FieldList} from 'sentry/views/settings/project/projectKeys/fieldList';

interface OtlpTabProps {
  integrationEndpoint: string;
  logsEndpoint: string;
  publicKey: string;
  tracesEndpoint: string;
}

const otlpSchema = z.object({
  otlpEndpoint: z.string(),
  logsEndpoint: z.string(),
  logsHeaders: z.string(),
  tracesEndpoint: z.string(),
  tracesHeaders: z.string(),
});

export function OtlpTab({
  logsEndpoint,
  tracesEndpoint,
  publicKey,
  integrationEndpoint,
}: OtlpTabProps) {
  const headers = `x-sentry-auth=sentry sentry_key=${publicKey}`;

  const collectorConfig = [
    'exporters:',
    '  otlphttp:',
    `    logs_endpoint: ${logsEndpoint}`,
    `    traces_endpoint: ${tracesEndpoint}`,
    '    headers:',
    `      x-sentry-auth: "sentry sentry_key=${publicKey}"`,
    '    compression: gzip',
    '    encoding: proto',
    '    timeout: 30s',
  ].join('\n');

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      otlpEndpoint: `${integrationEndpoint}otlp`,
      logsEndpoint,
      logsHeaders: headers,
      tracesEndpoint,
      tracesHeaders: headers,
    },
    validators: {onChange: otlpSchema},
  });

  return (
    <form.AppForm form={form}>
      <FieldList>
        <form.AppField name="otlpEndpoint">
          {field => (
            <field.Layout.Stack
              label={t('OTLP Endpoint')}
              hintText={t('The base OTLP endpoint for your project.')}
            >
              <field.Input
                readOnly
                dir="ltr"
                value={field.state.value}
                onClick={event => selectText(event.currentTarget)}
                trailingItems={<InputCopyButton text={field.state.value} />}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="logsEndpoint">
          {field => (
            <field.Layout.Stack
              label={t('OTLP Logs Endpoint')}
              hintText={tct(
                "Set this URL as your OTLP exporter's log endpoint. [link:Learn more]",
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/concepts/otlp/#opentelemetry-logs" />
                  ),
                }
              )}
            >
              <field.Input
                readOnly
                dir="ltr"
                value={field.state.value}
                onClick={event => selectText(event.currentTarget)}
                trailingItems={<InputCopyButton text={field.state.value} />}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="logsHeaders">
          {field => (
            <field.Layout.Stack
              label={t('OTLP Logs Endpoint Headers')}
              hintText={t(
                'Set these security headers when configuring your OTLP exporter.'
              )}
            >
              <field.Input
                readOnly
                dir="ltr"
                value={field.state.value}
                onClick={event => selectText(event.currentTarget)}
                trailingItems={<InputCopyButton text={field.state.value} />}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="tracesEndpoint">
          {field => (
            <field.Layout.Stack
              label={t('OTLP Traces Endpoint')}
              hintText={tct(
                "Set this URL as your OTLP exporter's trace endpoint. [link:Learn more]",
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/concepts/otlp/#opentelemetry-traces" />
                  ),
                }
              )}
            >
              <field.Input
                readOnly
                dir="ltr"
                value={field.state.value}
                onClick={event => selectText(event.currentTarget)}
                trailingItems={<InputCopyButton text={field.state.value} />}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="tracesHeaders">
          {field => (
            <field.Layout.Stack
              label={t('OTLP Traces Endpoint Headers')}
              hintText={t(
                'Set these security headers when configuring your OTLP exporter.'
              )}
            >
              <field.Input
                readOnly
                dir="ltr"
                value={field.state.value}
                onClick={event => selectText(event.currentTarget)}
                trailingItems={<InputCopyButton text={field.state.value} />}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <Stack
          gap="md"
          role="group"
          aria-label={t('OpenTelemetry Collector Exporter Configuration')}
        >
          <Text>{t('OpenTelemetry Collector Exporter Configuration')}</Text>
          <UnsetHeightCodeBlock language="yaml" filename="config.yaml" isRounded>
            {collectorConfig}
          </UnsetHeightCodeBlock>
          <Text size="sm" variant="muted">
            {t(
              'Use this example configuration in your OpenTelemetry Collector config file to export OTLP data to Sentry.'
            )}
          </Text>
        </Stack>
      </FieldList>
    </form.AppForm>
  );
}

const UnsetHeightCodeBlock = styled(CodeBlock)`
  pre {
    height: unset;
  }
`;
