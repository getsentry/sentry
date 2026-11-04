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
  apiKey: z.string().trim().min(1, t('API key is required')).max(255),
});

function LinearCredentialsStep({
  advance,
  advanceError,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<Record<string, never>, {apiKey: string}>) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {apiKey: ''},
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
            'Connect your Linear workspace so Seer can read issues, projects, and comments for everyone in your organization. Seer only reads from Linear.'
          )}
        </Text>
        <form.AppField name="apiKey">
          {field => (
            <field.Layout.Stack
              label={t('API key')}
              hintText={tct(
                'Create a [link:personal API key] with only the Read permission. Seer can read everything the key’s user can see.',
                {
                  link: (
                    <ExternalLink href="https://linear.app/settings/account/security" />
                  ),
                }
              )}
              required
            >
              <field.Password
                value={field.state.value}
                onChange={field.handleChange}
                autoComplete="new-password"
                placeholder="lin_api_..."
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

export const linearIntegrationPipeline = {
  type: 'integration',
  provider: 'linear',
  actionTitle: t('Installing Linear'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'linear_credentials',
      shortDescription: t('Configuring Linear credentials'),
      component: LinearCredentialsStep,
    },
  ],
} as const satisfies PipelineDefinition;
