import {useEffect} from 'react';
import {z} from 'zod';

import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
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
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

const credentialsSchema = z.object({
  url: z.string().trim().min(1, t('Grafana URL is required')).max(255),
  token: z.string().trim().min(1, t('Service account token is required')).max(255),
});

function GrafanaCredentialsStep({
  advance,
  advanceError,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<Record<string, never>, {token: string; url: string}>) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {url: '', token: ''},
    validators: {onDynamic: credentialsSchema},
    onSubmit: ({value}) => advance(credentialsSchema.parse(value)),
  });

  useEffect(() => {
    if (advanceError) {
      setFieldErrors(form, requestErrorToFieldErrors(advanceError, form.state.values));
    }
  }, [advanceError, form]);

  return (
    <form.AppForm form={form}>
      <Stack gap="lg">
        <Text>
          {t(
            'Connect your Grafana Cloud stack so Seer can query metrics and logs for everyone in your organization.'
          )}
        </Text>
        <form.AppField name="url">
          {field => (
            <field.Layout.Stack
              label={t('Grafana URL')}
              hintText={t(
                'Your Grafana Cloud stack URL, like https://your-stack.grafana.net.'
              )}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="https://your-stack.grafana.net"
                disabled={isAdvancing}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="token">
          {field => (
            <field.Layout.Stack
              label={t('Service account token')}
              hintText={tct(
                'Use a [link:service account token] that can read data sources in this stack.',
                {
                  link: (
                    <ExternalLink href="https://grafana.com/docs/grafana/latest/administration/service-accounts/" />
                  ),
                }
              )}
              required
            >
              <field.Password
                value={field.state.value}
                onChange={field.handleChange}
                autoComplete="new-password"
                disabled={isAdvancing}
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

export const grafanaIntegrationPipeline = {
  type: 'integration',
  provider: 'grafana',
  actionTitle: t('Installing Grafana'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'grafana_credentials',
      shortDescription: t('Configuring Grafana credentials'),
      component: GrafanaCredentialsStep,
    },
  ],
} as const satisfies PipelineDefinition;
