import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {z} from 'zod';

import {CodeBlock} from '@sentry/scraps/code';
import {defaultFormOptions, FieldGroup, useScrapsForm} from '@sentry/scraps/form';
import {ExternalLink} from '@sentry/scraps/link';

import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';

interface OtlpTabProps {
  integrationEndpoint: string;
  logsEndpoint: string;
  publicKey: string;
  showOtlpLogs: boolean;
  showOtlpTraces: boolean;
  tracesEndpoint: string;
}

const otlpSchema = z.object({
  otlpEndpoint: z.string(),
  logsEndpoint: z.string(),
  logsHeaders: z.string(),
  tracesEndpoint: z.string(),
  tracesHeaders: z.string(),
  collectorConfig: z.string(),
});

export function OtlpTab({
  logsEndpoint,
  tracesEndpoint,
  publicKey,
  showOtlpLogs,
  showOtlpTraces,
  integrationEndpoint,
}: OtlpTabProps) {
  const headers = `x-sentry-auth=sentry sentry_key=${publicKey}`;

  const buildCollectorConfig = useMemo(() => {
    const lines = ['exporters:', '  otlphttp:'];

    if (showOtlpLogs) {
      lines.push(`    logs_endpoint: ${logsEndpoint}`);
    }

    if (showOtlpTraces) {
      lines.push(`    traces_endpoint: ${tracesEndpoint}`);
    }

    lines.push(
      '    headers:',
      `      x-sentry-auth: "sentry sentry_key=${publicKey}"`,
      '    compression: gzip',
      '    encoding: proto',
      '    timeout: 30s'
    );

    return lines.join('\n');
  }, [showOtlpLogs, showOtlpTraces, logsEndpoint, tracesEndpoint, publicKey]);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      otlpEndpoint: `${integrationEndpoint}otlp`,
      logsEndpoint,
      logsHeaders: headers,
      tracesEndpoint,
      tracesHeaders: headers,
      collectorConfig: buildCollectorConfig,
    },
    validators: {onChange: otlpSchema},
  });

  if (!showOtlpLogs && !showOtlpTraces) {
    return;
  }

  return (
    <form.AppForm form={form}>
      <FieldGroup hideBorder>
        <form.AppField name="otlpEndpoint">
          {field => (
            <field.Layout.Stack
              label={t('OTLP Endpoint')}
              hintText={t('The base OTLP endpoint for your project.')}
            >
              <TextCopyInput aria-label={t('OTLP Endpoint')}>
                {field.state.value}
              </TextCopyInput>
            </field.Layout.Stack>
          )}
        </form.AppField>

        {showOtlpLogs && (
          <Fragment>
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
                  <TextCopyInput aria-label={t('OTLP Logs Endpoint')}>
                    {field.state.value}
                  </TextCopyInput>
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
                  <TextCopyInput aria-label={t('OTLP Logs Endpoint Headers')}>
                    {field.state.value}
                  </TextCopyInput>
                </field.Layout.Stack>
              )}
            </form.AppField>
          </Fragment>
        )}

        {showOtlpTraces && (
          <Fragment>
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
                  <TextCopyInput aria-label={t('OTLP Traces Endpoint')}>
                    {field.state.value}
                  </TextCopyInput>
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
                  <TextCopyInput aria-label={t('OTLP Traces Endpoint Headers')}>
                    {field.state.value}
                  </TextCopyInput>
                </field.Layout.Stack>
              )}
            </form.AppField>
          </Fragment>
        )}

        <form.AppField name="collectorConfig">
          {field => (
            <field.Layout.Stack
              label={t('OpenTelemetry Collector Exporter Configuration')}
              hintText={t(
                'Use this example configuration in your OpenTelemetry Collector config file to export OTLP data to Sentry.'
              )}
            >
              <UnsetHeightCodeBlock language="yaml" filename="config.yaml" isRounded>
                {field.state.value}
              </UnsetHeightCodeBlock>
            </field.Layout.Stack>
          )}
        </form.AppField>
      </FieldGroup>
    </form.AppForm>
  );
}

const UnsetHeightCodeBlock = styled(CodeBlock)`
  pre {
    height: unset;
  }
`;
