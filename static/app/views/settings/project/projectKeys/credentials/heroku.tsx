import {createSerializer, parseAsString} from 'nuqs';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading} from '@sentry/scraps/text';

import {InputCopyButton} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {selectText} from 'sentry/utils/selectText';
import {useLocation} from 'sentry/utils/useLocation';
import {FieldList} from 'sentry/views/settings/project/projectKeys/fieldList';

interface HerokuTabProps {
  integrationEndpoint: string;
  publicKey: string;
}

const serializeTabQuery = createSerializer({tab: parseAsString});

const herokuSchema = z.object({otlpEndpoint: z.string(), logDrainUrl: z.string()});

export function HerokuTab({integrationEndpoint, publicKey}: HerokuTabProps) {
  const location = useLocation();
  const logDrainUrl = `${integrationEndpoint}heroku/logs?sentry_key=${publicKey}`;

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {otlpEndpoint: `${integrationEndpoint}otlp`, logDrainUrl},
    validators: {onChange: herokuSchema},
  });

  return (
    <form.AppForm form={form}>
      <FieldList>
        <Stack gap="md">
          <Heading as="h3">{t('Fir')}</Heading>
          <form.AppField name="otlpEndpoint">
            {field => (
              <field.Layout.Stack
                label={t('OTLP Endpoint')}
                hintText={tct('Same as the [link:OpenTelemetry (OTLP)] tab.', {
                  link: (
                    <Link
                      to={{
                        pathname: location.pathname,
                        search: serializeTabQuery(location.search, {tab: 'otlp'}),
                      }}
                    />
                  ),
                })}
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
        </Stack>

        <Stack gap="md">
          <Heading as="h3">{t('Cedar')}</Heading>
          <form.AppField name="logDrainUrl">
            {field => (
              <field.Layout.Stack
                label={t('Heroku Log Drain URL')}
                hintText={tct(
                  'Log drains cannot send headers, so the key is in the query string. [link:Learn more]',
                  {
                    link: (
                      <ExternalLink href="https://devcenter.heroku.com/articles/log-drains#https-drains" />
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
        </Stack>
      </FieldList>
    </form.AppForm>
  );
}
