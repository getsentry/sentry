import {useCallback, useEffect} from 'react';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import type {OAuthCallbackData} from 'sentry/components/pipeline/shared/oauthLoginStep';
import {OAuthLoginStep} from 'sentry/components/pipeline/shared/oauthLoginStep';
import {useRedirectPopupStep} from 'sentry/components/pipeline/shared/useRedirectPopupStep';
import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/utils';
import {t, tct} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

const installationConfigSchema = z.object({
  url: z
    .string()
    .min(1, t('Installation URL is required'))
    .transform(v => v.replace(/\/+$/, '')),
  id: z.string().min(1, t('GitHub App ID is required')),
  name: z.string().min(1, t('GitHub App Name is required')),
  publicLink: z.string(),
  verifySsl: z.boolean(),
  webhookSecret: z.string().min(1, t('Webhook Secret is required')),
  privateKey: z.string().min(1, t('Private Key is required')),
  clientId: z.string().min(1, t('OAuth Client ID is required')),
  clientSecret: z.string().min(1, t('OAuth Client Secret is required')),
});

interface InstallationConfigStepData {
  defaults?: {
    verifySsl?: boolean;
  };
}

interface InstallationConfigAdvanceData {
  clientId: string;
  clientSecret: string;
  id: string;
  name: string;
  privateKey: string;
  publicLink: string;
  url: string;
  verifySsl: boolean;
  webhookSecret: string;
}

function InstallationConfigStep({
  stepData,
  advance,
  advanceError,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<InstallationConfigStepData, InstallationConfigAdvanceData>) {
  const defaults = stepData?.defaults ?? {};

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      url: '',
      id: '',
      name: '',
      publicLink: '',
      verifySsl: defaults.verifySsl ?? true,
      webhookSecret: '',
      privateKey: '',
      clientId: '',
      clientSecret: '',
    },
    validators: {onDynamic: installationConfigSchema},
    onSubmit: ({value}) => {
      advance(installationConfigSchema.parse(value));
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
          {tct(
            'Create a GitHub App on your GitHub Enterprise instance and enter the details below. Refer to the [link:documentation] for setup instructions.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/organization/integrations/source-code-mgmt/github-enterprise/" />
              ),
            }
          )}
        </Text>

        <form.AppField name="url">
          {field => (
            <field.Layout.Stack
              label={t('Installation URL')}
              hintText={t(
                'The base URL for your GitHub Enterprise instance, including the protocol.'
              )}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="https://github.example.com"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="id">
          {field => (
            <field.Layout.Stack
              label={t('GitHub App ID')}
              hintText={t("Found on your app's settings page.")}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="1"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="name">
          {field => (
            <field.Layout.Stack
              label={t('GitHub App Name')}
              hintText={t(
                "The slug of your GitHub App, found on the app's settings page."
              )}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="our-sentry-app"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="webhookSecret">
          {field => (
            <field.Layout.Stack
              label={t('Webhook Secret')}
              hintText={t(
                'The webhook secret configured for your GitHub App. Must match the value in your app settings.'
              )}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                type="password"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="privateKey">
          {field => (
            <field.Layout.Stack
              label={t('Private Key')}
              hintText={t('The private key generated for your GitHub App.')}
              required
            >
              <field.TextArea
                value={field.state.value}
                onChange={field.handleChange}
                rows={3}
                monospace
                placeholder={
                  '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
                }
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="clientId">
          {field => (
            <field.Layout.Stack label={t('OAuth Client ID')} required>
              <field.Input value={field.state.value} onChange={field.handleChange} />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="clientSecret">
          {field => (
            <field.Layout.Stack label={t('OAuth Client Secret')} required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                type="password"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="publicLink">
          {field => (
            <field.Layout.Stack
              label={t('Public Link')}
              hintText={t(
                'The publicly available link for your GitHub App, if different from the default.'
              )}
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="https://github.example.com/github-apps/our-sentry-app"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="verifySsl">
          {field => (
            <field.Layout.Stack
              label={t('Verify SSL')}
              hintText={t(
                'Verify SSL certificates when communicating with your GitHub Enterprise instance.'
              )}
            >
              <field.Switch checked={field.state.value} onChange={field.handleChange} />
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

interface AppInstallStepData {
  appInstallUrl?: string;
}

function AppInstallRedirectStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<AppInstallStepData, {installationId: string}>) {
  const handleCallback = useCallback(
    (data: Record<string, string>) => {
      if (data.installation_id) {
        advance({installationId: data.installation_id});
      }
    },
    [advance]
  );

  const {openPopup, isWaitingForCallback, popupStatus} = useRedirectPopupStep({
    redirectUrl: stepData?.appInstallUrl,
    onCallback: handleCallback,
  });

  return (
    <Stack gap="lg" align="start">
      <Stack gap="sm">
        <Text>
          {t(
            'Install the GitHub App on your GitHub Enterprise instance to grant Sentry access.'
          )}
        </Text>
        {isWaitingForCallback && (
          <Text variant="muted" size="sm">
            {t(
              'Complete the installation in the popup window. This page will update automatically.'
            )}
          </Text>
        )}
        {popupStatus === 'failed-to-open' && (
          <Text variant="danger" size="sm">
            {t(
              'The installation popup was blocked by your browser. Please ensure popups are allowed and try again.'
            )}
          </Text>
        )}
      </Stack>
      {isWaitingForCallback && !isAdvancing ? (
        <Button size="sm" onClick={openPopup}>
          {t('Reopen installation window')}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="primary"
          onClick={openPopup}
          busy={isAdvancing}
          disabled={!stepData?.appInstallUrl}
        >
          {t('Install GitHub App')}
        </Button>
      )}
    </Stack>
  );
}

function GHEOAuthLoginStep({
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
      serviceName="GitHub Enterprise"
      onOAuthCallback={handleOAuthCallback}
    />
  );
}

export const githubEnterpriseIntegrationPipeline = {
  type: 'integration',
  provider: 'github_enterprise',
  actionTitle: t('Installing GitHub Enterprise Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'installation_config',
      shortDescription: t('Configuring GitHub Enterprise connection'),
      component: InstallationConfigStep,
    },
    {
      stepId: 'app_install_redirect',
      shortDescription: t('Installing GitHub App'),
      component: AppInstallRedirectStep,
    },
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing via OAuth'),
      component: GHEOAuthLoginStep,
    },
  ],
} as const satisfies PipelineDefinition;
