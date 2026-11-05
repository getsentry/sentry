import {z} from 'zod';

import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';
import {ExternalLink} from '@sentry/scraps/link';

import {InputCopyButton} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {selectText} from 'sentry/utils/selectText';
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
    defaultValues: {
      logDrainEndpoint: `${integrationEndpoint}vercel/logs`,
      logDrainHeaders: headers,
      traceDrainEndpoint: tracesEndpoint,
      traceDrainHeaders: headers,
    },
    validators: defaultFormValidators(vercelSchema),
  });

  return (
    <ScrapsForm form={form}>
      <FieldList>
        <form.Field name="logDrainEndpoint">
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
              <field.Input
                readOnly
                dir="ltr"
                value={field.value}
                onClick={event => selectText(event.currentTarget)}
                trailingItems={<InputCopyButton text={field.value} />}
              />
            </field.Layout.Stack>
          )}
        </form.Field>

        <form.Field name="logDrainHeaders">
          {field => (
            <field.Layout.Stack
              label={t('Log Drain Authentication Headers')}
              hintText={t(
                'Set these authentication headers when configuring your Vercel Log Drain.'
              )}
            >
              <field.Input
                readOnly
                dir="ltr"
                value={field.value}
                onClick={event => selectText(event.currentTarget)}
                trailingItems={<InputCopyButton text={field.value} />}
              />
            </field.Layout.Stack>
          )}
        </form.Field>

        <form.Field name="traceDrainEndpoint">
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
              <field.Input
                readOnly
                dir="ltr"
                value={field.value}
                onClick={event => selectText(event.currentTarget)}
                trailingItems={<InputCopyButton text={field.value} />}
              />
            </field.Layout.Stack>
          )}
        </form.Field>

        <form.Field name="traceDrainHeaders">
          {field => (
            <field.Layout.Stack
              label={t('Vercel Trace Drain Authentication Headers')}
              hintText={t(
                'Set these security headers when configuring your Vercel Trace Drain.'
              )}
            >
              <field.Input
                readOnly
                dir="ltr"
                value={field.value}
                onClick={event => selectText(event.currentTarget)}
                trailingItems={<InputCopyButton text={field.value} />}
              />
            </field.Layout.Stack>
          )}
        </form.Field>
      </FieldList>
    </ScrapsForm>
  );
}
