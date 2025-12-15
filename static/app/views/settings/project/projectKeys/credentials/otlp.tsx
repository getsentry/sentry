import {Fragment, useMemo} from 'react';

import {CodeBlock} from '@sentry/scraps/code';

import {ExternalLink} from 'sentry/components/core/link';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';

interface OtlpTabProps {
  integrationEndpoint: string;
  logsEndpoint: string;
  publicKey: string;
  showOtlpLogs: boolean;
  showOtlpTraces: boolean;
  tracesEndpoint: string;
}

export function OtlpTab({
  logsEndpoint,
  tracesEndpoint,
  publicKey,
  showOtlpLogs,
  showOtlpTraces,
  integrationEndpoint,
}: OtlpTabProps) {
  // Build the OTEL collector config example
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

  if (!showOtlpLogs && !showOtlpTraces) {
    return undefined;
  }

  return (
    <Fragment>
      <FieldGroup
        label={t('OTLP Endpoint')}
        help={t('The base OTLP endpoint for your project.')}
        inline={false}
        flexibleControlStateSize
      >
        <TextCopyInput aria-label={t('OTLP Endpoint')}>
          {`${integrationEndpoint}otlp`}
        </TextCopyInput>
      </FieldGroup>
      {showOtlpLogs && (
        <Fragment>
          <FieldGroup
            label={t('OTLP Logs Endpoint')}
            help={tct(
              `Set this URL as your OTLP exporter's log endpoint. [link:Learn more]`,
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/concepts/otlp/#opentelemetry-logs" />
                ),
              }
            )}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('OTLP Logs Endpoint')}>
              {logsEndpoint}
            </TextCopyInput>
          </FieldGroup>

          <FieldGroup
            label={t('OTLP Logs Endpoint Headers')}
            help={t(`Set these security headers when configuring your OTLP exporter.`)}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('OTLP Logs Endpoint Headers')}>
              {`x-sentry-auth=sentry sentry_key=${publicKey}`}
            </TextCopyInput>
          </FieldGroup>
        </Fragment>
      )}

      {showOtlpTraces && (
        <Fragment>
          <FieldGroup
            label={t('OTLP Traces Endpoint')}
            help={tct(
              `Set this URL as your OTLP exporter's trace endpoint. [link:Learn more]`,
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/concepts/otlp/#opentelemetry-traces" />
                ),
              }
            )}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('OTLP Traces Endpoint')}>
              {tracesEndpoint}
            </TextCopyInput>
          </FieldGroup>

          <FieldGroup
            label={t('OTLP Traces Endpoint Headers')}
            help={t(`Set these security headers when configuring your OTLP exporter.`)}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('OTLP Traces Endpoint Headers')}>
              {`x-sentry-auth=sentry sentry_key=${publicKey}`}
            </TextCopyInput>
          </FieldGroup>
        </Fragment>
      )}

      <FieldGroup
        label={t('OpenTelemetry Collector Exporter Configuration')}
        help={t(
          'Use this example configuration in your OpenTelemetry Collector config file to export OTLP data to Sentry.'
        )}
        inline={false}
        flexibleControlStateSize
      >
        <CodeBlock language="yaml" filename="config.yaml">
          {buildCollectorConfig}
        </CodeBlock>
      </FieldGroup>
    </Fragment>
  );
}
