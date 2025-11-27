import {Fragment} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';

interface VercelTabProps {
  integrationEndpoint: string;
  publicKey: string;
  showOtlpTraces: boolean;
  tracesEndpoint: string;
}

export function VercelTab({
  integrationEndpoint,
  publicKey,
  showOtlpTraces,
  tracesEndpoint,
}: VercelTabProps) {
  return (
    <Fragment>
      <FieldGroup
        label={t('Vercel Log Drain Endpoint')}
        help={tct('Use this endpoint to configure Vercel Log Drains. [link:Learn more]', {
          link: (
            <ExternalLink href="https://docs.sentry.io/product/drains/integration/vercel/#log-drains" />
          ),
        })}
        inline={false}
        flexibleControlStateSize
      >
        <TextCopyInput aria-label={t('Vercel Log Drain Endpoint')}>
          {`${integrationEndpoint}vercel/logs`}
        </TextCopyInput>
      </FieldGroup>

      <FieldGroup
        label={t('Log Drain Authentication Headers')}
        help={t(
          'Set these authentication headers when configuring your Vercel Log Drain.'
        )}
        inline={false}
        flexibleControlStateSize
      >
        <TextCopyInput aria-label={t('Log Drain Authentication Header')}>
          {`x-sentry-auth: sentry sentry_key=${publicKey}`}
        </TextCopyInput>
      </FieldGroup>
      {showOtlpTraces && (
        <Fragment>
          <FieldGroup
            label={t('Vercel Trace Drain Endpoint')}
            help={tct(
              `Set this URL as your Vercel Trace Drain Endpoint (OTLP format). [link:Learn more]`,
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/drains/integration/vercel/#trace-drains" />
                ),
              }
            )}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('Vercel Trace Drain Endpoint')}>
              {tracesEndpoint}
            </TextCopyInput>
          </FieldGroup>

          <FieldGroup
            label={t('Vercel Trace Drain Authentication Headers')}
            help={t(
              `Set these security headers when configuring your Vercel Trace Drain.`
            )}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('Vercel Trace Drain Authentication Header')}>
              {`x-sentry-auth: sentry sentry_key=${publicKey}`}
            </TextCopyInput>
          </FieldGroup>
        </Fragment>
      )}
    </Fragment>
  );
}
