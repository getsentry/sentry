import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {ExternalLink} from '@sentry/scraps/link';

import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {FieldList} from 'sentry/views/settings/project/projectKeys/fieldList';

interface VercelTabProps {
  integrationEndpoint: string;
  publicKey: string;
  tracesEndpoint: string;
}

const vercelSchema = z.object({
  logDrainEndpoint: z.string(),
  logDrainHeaders: z.string(),
  traceDrainEndpoint: z.string(),
  traceDrainHeaders: z.string(),
});

export function VercelTab({
  integrationEndpoint,
  publicKey,
  tracesEndpoint,
}: VercelTabProps) {
  const headers = `x-sentry-auth: sentry sentry_key=${publicKey}`;

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      logDrainEndpoint: `${integrationEndpoint}vercel/logs`,
      logDrainHeaders: headers,
      traceDrainEndpoint: tracesEndpoint,
      traceDrainHeaders: headers,
    },
    validators: {onChange: vercelSchema},
  });

  return (
    <form.AppForm form={form}>
      <FieldList>
        <form.AppField name="logDrainEndpoint">
          {field => (
            <field.Layout.Stack
              label={t('Vercel Log Drain Endpoint')}
              hintText={tct(
                'Use this endpoint to configure Vercel Log Drains. [link:Learn more]',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/drains/integration/vercel/#log-drains" />
                  ),
                }
              )}
            >
              <TextCopyInput aria-label={t('Vercel Log Drain Endpoint')}>
                {field.state.value}
              </TextCopyInput>
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="logDrainHeaders">
          {field => (
            <field.Layout.Stack
              label={t('Log Drain Authentication Headers')}
              hintText={t(
                'Set these authentication headers when configuring your Vercel Log Drain.'
              )}
            >
              <TextCopyInput aria-label={t('Log Drain Authentication Header')}>
                {field.state.value}
              </TextCopyInput>
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="traceDrainEndpoint">
          {field => (
            <field.Layout.Stack
              label={t('Vercel Trace Drain Endpoint')}
              hintText={tct(
                'Set this URL as your Vercel Trace Drain Endpoint (OTLP format). [link:Learn more]',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/drains/integration/vercel/#trace-drains" />
                  ),
                }
              )}
            >
              <TextCopyInput aria-label={t('Vercel Trace Drain Endpoint')}>
                {field.state.value}
              </TextCopyInput>
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="traceDrainHeaders">
          {field => (
            <field.Layout.Stack
              label={t('Vercel Trace Drain Authentication Headers')}
              hintText={t(
                'Set these security headers when configuring your Vercel Trace Drain.'
              )}
            >
              <TextCopyInput aria-label={t('Vercel Trace Drain Authentication Header')}>
                {field.state.value}
              </TextCopyInput>
            </field.Layout.Stack>
          )}
        </form.AppField>
      </FieldList>
    </form.AppForm>
  );
}
