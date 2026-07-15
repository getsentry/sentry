import {useEffect} from 'react';
import {z} from 'zod';

import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

// Datadog sites and their region labels. Keep in sync with DATADOG_VALID_SITES in
// src/sentry/identity/datadog/provider.py.
const DATADOG_SITE_OPTIONS = [
  {value: 'datadoghq.com', label: 'US1 (datadoghq.com)'},
  {value: 'us3.datadoghq.com', label: 'US3 (us3.datadoghq.com)'},
  {value: 'us5.datadoghq.com', label: 'US5 (us5.datadoghq.com)'},
  {value: 'datadoghq.eu', label: 'EU (datadoghq.eu)'},
  {value: 'ap1.datadoghq.com', label: 'AP1 (ap1.datadoghq.com)'},
  {value: 'ap2.datadoghq.com', label: 'AP2 (ap2.datadoghq.com)'},
  {value: 'ddog-gov.com', label: 'US1-FED (ddog-gov.com)'},
  {value: 'us2.ddog-gov.com', label: 'US2-FED (us2.ddog-gov.com)'},
];

const credentialsSchema = z.object({
  apiKey: z.string().min(1, t('API key is required')),
  appKey: z.string().min(1, t('Application key is required')),
  site: z.string().min(1, t('Site is required')),
});

function DatadogCredentialsStep({
  advance,
  advanceError,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<
  Record<string, never>,
  {apiKey: string; appKey: string; site: string}
>) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {apiKey: '', appKey: '', site: ''},
    validators: {onDynamic: credentialsSchema},
    onSubmit: ({value}) => {
      advance({apiKey: value.apiKey, appKey: value.appKey, site: value.site});
    },
  });

  useEffect(() => {
    if (advanceError) {
      setFieldErrors(form, advanceError);
    }
  }, [advanceError, form]);

  return (
    <form.AppForm form={form}>
      <Stack gap="lg">
        <Text>
          {t(
            'Enter an organization-level Datadog API key and application key so Seer can access your Datadog telemetry.'
          )}
        </Text>
        <form.AppField name="site">
          {field => (
            <field.Layout.Stack label={t('Datadog Site')} required>
              <field.Select
                value={field.state.value}
                onChange={value => field.handleChange(value)}
                placeholder={t('Select your Datadog site')}
                options={DATADOG_SITE_OPTIONS}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="apiKey">
          {field => (
            <field.Layout.Stack label={t('API Key')} required>
              <field.Input
                type="password"
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="********************************"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="appKey">
          {field => (
            <field.Layout.Stack label={t('Application Key')} required>
              <field.Input
                type="password"
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="****************************************"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <Flex>
          <form.SubmitButton busy={isAdvancing} disabled={isInitializing}>
            {t('Continue')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
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
