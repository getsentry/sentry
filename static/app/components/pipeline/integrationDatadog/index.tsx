import {z} from 'zod';

import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {t, tct} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {DATADOG_SITES, DATADOG_SITE_VALUES} from 'sentry/utils/seer/datadogSites';

const DATADOG_API_KEYS_DOCS_URL =
  'https://docs.datadoghq.com/account_management/api-app-keys/';

// Deep-links to the settings page for the selected site, falling back to the docs
// when no (or an unrecognized) site is selected rather than guessing a host.
function datadogOrgSettingsUrl(
  site: string,
  page: 'api-keys' | 'application-keys'
): string {
  const appHost = DATADOG_SITES.find(s => s.value === site)?.appHost;
  return appHost
    ? `https://${appHost}/organization-settings/${page}`
    : DATADOG_API_KEYS_DOCS_URL;
}

const credentialsSchema = z.object({
  apiKey: z.string().min(1, t('API key is required')),
  appKey: z.string().min(1, t('Application key is required')),
  site: z.enum(DATADOG_SITE_VALUES, {error: t('Site is required')}),
});

function DatadogCredentialsStep({
  advance,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<
  Record<string, never>,
  {apiKey: string; appKey: string; site: string}
>) {
  const form = useScrapsForm({
    defaultValues: {apiKey: '', appKey: '', site: ''},
    validators: defaultFormValidators(credentialsSchema),
    onSubmit: ({value, createValidationError}) =>
      advance({apiKey: value.apiKey, appKey: value.appKey, site: value.site}).catch(
        error => {
          if (error instanceof RequestError) {
            const fields = requestErrorToFieldErrors(error, value);
            return fields ? createValidationError({fields}) : undefined;
          }
          throw error;
        }
      ),
  });

  return (
    <ScrapsForm form={form}>
      <Stack gap="lg">
        <Text>
          {t(
            'Enter an organization-level Datadog API key and application key so Seer can access your Datadog telemetry.'
          )}
        </Text>
        <form.Field name="site">
          {field => (
            <field.Layout.Stack
              label={t('Datadog Site')}
              hintText={t(
                'The region your Datadog organization is hosted in, shown in your Datadog URL.'
              )}
              required
            >
              <field.Select
                value={field.value}
                onChange={value => field.handleChange(value)}
                placeholder={t('Select your Datadog site')}
                options={DATADOG_SITES}
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Subscribe selector={state => state.values.site}>
          {site => {
            return (
              <Stack gap="lg">
                <form.Field name="apiKey">
                  {field => (
                    <field.Layout.Stack
                      label={t('API Key')}
                      hintText={tct(
                        'Identifies your Datadog organization. Create one under [link:Organization Settings › API Keys].',
                        {
                          link: (
                            <ExternalLink
                              href={datadogOrgSettingsUrl(site, 'api-keys')}
                            />
                          ),
                        }
                      )}
                      required
                    >
                      <field.Password
                        value={field.value}
                        onChange={value => field.handleChange(value.trim())}
                        placeholder="********************************"
                      />
                    </field.Layout.Stack>
                  )}
                </form.Field>
                <form.Field name="appKey">
                  {field => (
                    <field.Layout.Stack
                      label={t('Application Key')}
                      hintText={tct(
                        'Authorizes requests on top of the API key. Create one under [link:Organization Settings › Application Keys].',
                        {
                          link: (
                            <ExternalLink
                              href={datadogOrgSettingsUrl(site, 'application-keys')}
                            />
                          ),
                        }
                      )}
                      required
                    >
                      <field.Password
                        value={field.value}
                        onChange={value => field.handleChange(value.trim())}
                        placeholder="****************************************"
                      />
                    </field.Layout.Stack>
                  )}
                </form.Field>
              </Stack>
            );
          }}
        </form.Subscribe>
        <Flex>
          <form.SubmitButton busy={isAdvancing} disabled={isInitializing}>
            {t('Continue')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </ScrapsForm>
  );
}

export const datadogIntegrationPipeline = {
  type: 'integration',
  provider: 'datadog',
  actionTitle: t('Installing Datadog'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'datadog_credentials',
      shortDescription: t('Configuring Datadog credentials'),
      component: DatadogCredentialsStep,
    },
  ],
} as const satisfies PipelineDefinition;
