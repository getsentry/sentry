import {z} from 'zod';

import {
  defaultFormValidators,
  ScrapsForm,
  toFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {DATADOG_SITES, DATADOG_SITE_VALUES} from 'sentry/utils/seer/datadogSites';

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
            return toFieldErrors({value, createValidationError}, error);
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
            <field.Layout.Stack label={t('Datadog Site')} required>
              <field.Select
                value={field.value}
                onChange={value => field.handleChange(value)}
                placeholder={t('Select your Datadog site')}
                options={DATADOG_SITES}
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Field name="apiKey">
          {field => (
            <field.Layout.Stack label={t('API Key')} required>
              <field.Input
                type="password"
                value={field.value}
                onChange={field.handleChange}
                placeholder="********************************"
              />
            </field.Layout.Stack>
          )}
        </form.Field>
        <form.Field name="appKey">
          {field => (
            <field.Layout.Stack label={t('Application Key')} required>
              <field.Input
                type="password"
                value={field.value}
                onChange={field.handleChange}
                placeholder="****************************************"
              />
            </field.Layout.Stack>
          )}
        </form.Field>
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
