import {useCallback, useEffect} from 'react';
import {z} from 'zod';

import {CodeBlock} from '@sentry/scraps/code';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import type {OAuthCallbackData} from 'sentry/components/pipeline/shared/oauthLoginStep';
import {OAuthLoginStep} from 'sentry/components/pipeline/shared/oauthLoginStep';
import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {t, tct} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

const installationConfigSchema = z.object({
  // Gitea's ROOT_URL is free-form and may include a sub-path
  // (https://example.com/gitea/), so we collect and store the whole base URL
  // rather than just a hostname.
  url: z.httpUrl(t('A valid Gitea URL is required')),
  clientId: z.string().min(1, t('Client ID is required')),
  clientSecret: z.string().min(1, t('Client Secret is required')),
});

interface InstallationConfigStepData {
  setupValues?: Array<{label: string; value: string}>;
}

interface InstallationConfigAdvanceData {
  client_id: string;
  client_secret: string;
  url: string;
}

function InstallationConfigStep({
  stepData,
  advance,
  advanceError,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<InstallationConfigStepData, InstallationConfigAdvanceData>) {
  const setupValues = stepData?.setupValues ?? [];

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      url: '',
      clientId: '',
      clientSecret: '',
    },
    validators: {onDynamic: installationConfigSchema},
    onSubmit: ({value}) => {
      advance({
        url: value.url.replace(/\/+$/, ''),
        client_id: value.clientId,
        client_secret: value.clientSecret,
      });
    },
  });

  useEffect(() => {
    if (advanceError) {
      setFieldErrors(form, advanceError);
    }
  }, [advanceError, form]);

  const configForm = (
    <form.AppForm form={form}>
      <Stack gap="lg">
        <form.AppField name="url">
          {field => (
            <field.Layout.Stack
              label={t('Gitea URL')}
              hintText={t(
                'The base URL of your Gitea instance, including the protocol and any sub-path. Sentry must be able to reach it over the public internet.'
              )}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="https://gitea.example.com"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="clientId">
          {field => (
            <field.Layout.Stack label={t('Client ID')} required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('Client ID from your Gitea OAuth application')}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="clientSecret">
          {field => (
            <field.Layout.Stack label={t('Client Secret')} required>
              <field.Input
                type="password"
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('Client Secret from your Gitea OAuth application')}
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

  return (
    <Stack gap="lg">
      <Text>
        {t(
          'To connect Sentry with your Gitea instance, you need to create an OAuth application in Gitea.'
        )}
      </Text>
      <GuidedSteps>
        <GuidedSteps.Step stepKey="navigate" title={t('Open Gitea application settings')}>
          <Stack gap="xs">
            <Text density="comfortable">
              {tct(
                'Navigate to [bold:Settings › Applications] on your Gitea instance and create a new OAuth2 application. See the [link:Gitea OAuth2 docs] for details.',
                {
                  bold: <strong />,
                  link: (
                    <ExternalLink href="https://docs.gitea.com/development/oauth2-provider" />
                  ),
                }
              )}
            </Text>
            <Text variant="muted" size="sm">
              {t(
                'Gitea attributes every API call to the user who authorizes the app, so we recommend doing this as a dedicated bot account rather than a personal one.'
              )}
            </Text>
          </Stack>
          <GuidedSteps.StepButtons />
        </GuidedSteps.Step>
        <GuidedSteps.Step stepKey="create" title={t('Create a new application')}>
          <Stack gap="sm">
            {setupValues.map(({label, value}) => (
              <Stack key={label} gap="xs">
                <Text bold size="sm">
                  {label}
                </Text>
                <CodeBlock>{value}</CodeBlock>
              </Stack>
            ))}
          </Stack>
          <GuidedSteps.StepButtons />
        </GuidedSteps.Step>
        <GuidedSteps.Step stepKey="configure" title={t('Configure the integration')}>
          {configForm}
        </GuidedSteps.Step>
      </GuidedSteps>
    </Stack>
  );
}

function GiteaOAuthLoginStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<{oauthUrl?: string}, {code: string; state: string}>) {
  const handleOAuthCallback = useCallback(
    (data: OAuthCallbackData) => {
      advance({code: data.code, state: data.state});
    },
    [advance]
  );

  return (
    <OAuthLoginStep
      oauthUrl={stepData?.oauthUrl}
      isLoading={isAdvancing}
      serviceName="Gitea"
      onOAuthCallback={handleOAuthCallback}
    />
  );
}

export const giteaIntegrationPipeline = {
  type: 'integration',
  provider: 'gitea',
  actionTitle: t('Installing Gitea Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'installation_config',
      shortDescription: t('Configuring Gitea connection'),
      component: InstallationConfigStep,
    },
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing via Gitea OAuth flow'),
      component: GiteaOAuthLoginStep,
    },
  ],
} as const satisfies PipelineDefinition;
