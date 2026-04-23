import {useEffect} from 'react';
import {z} from 'zod';

import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

import type {PipelineDefinition, PipelineStepProps} from './types';
import {pipelineComplete} from './types';

const AUTH_TYPE_CHOICES = [
  {value: 'password', label: t('Password')},
  {value: 'ticket', label: t('P4 Ticket')},
];

interface InstallationConfigAdvanceData {
  authType: string;
  p4port: string;
  password: string;
  user: string;
  client?: string;
  sslFingerprint?: string;
  webUrl?: string;
}

const installationConfigSchema = z
  .object({
    p4port: z.string().min(1, t('Server address is required')),
    user: z.string().min(1, t('Username is required')),
    authType: z.string().min(1, t('Authentication type is required')),
    password: z.string().min(1, t('Password is required')),
    client: z.string(),
    sslFingerprint: z.string(),
    webUrl: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.p4port.startsWith('ssl:') && !data.sslFingerprint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sslFingerprint'],
        message: t('SSL fingerprint is required when P4PORT uses ssl:'),
      });
    }
  });

function PerforceInstallationConfigStep({
  advance,
  advanceError,
  isAdvancing,
  isInitializing,
}: PipelineStepProps<Record<string, unknown>, InstallationConfigAdvanceData>) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      p4port: '',
      user: '',
      authType: 'password',
      password: '',
      client: '',
      sslFingerprint: '',
      webUrl: '',
    },
    validators: {onDynamic: installationConfigSchema},
    onSubmit: ({value}) => {
      advance({
        p4port: value.p4port,
        user: value.user,
        authType: value.authType,
        password: value.password,
        client: value.client || undefined,
        sslFingerprint: value.sslFingerprint || undefined,
        webUrl: value.webUrl || undefined,
      });
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
            'Configure your Perforce server connection to enable stacktrace linking and commit tracking.'
          )}
        </Text>
        <form.AppField name="p4port">
          {field => (
            <field.Layout.Stack
              label={t('P4PORT (Server Address)')}
              hintText={t(
                "Perforce server address in P4PORT format (e.g. 'ssl:perforce.company.com:1666')"
              )}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="ssl:perforce.company.com:1666"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="user">
          {field => (
            <field.Layout.Stack label={t('Perforce Username')} required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="sentry-bot"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="authType">
          {field => (
            <field.Layout.Stack label={t('Authentication Type')} required>
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={AUTH_TYPE_CHOICES}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="password">
          {field => (
            <field.Layout.Stack label={t('Password / Ticket')} required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('Password or P4 ticket')}
                type="password"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="client">
          {field => (
            <field.Layout.Stack label={t('Perforce Client/Workspace')}>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="sentry-workspace"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="sslFingerprint">
          {field => (
            <field.Layout.Stack label={t('SSL Fingerprint')}>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="AB:CD:EF:..."
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="webUrl">
          {field => (
            <field.Layout.Stack label={t('P4 Code Review URL')}>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="https://swarm.company.com"
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <Flex>
          <form.SubmitButton disabled={isAdvancing || isInitializing}>
            {isAdvancing ? t('Connecting...') : t('Connect')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}

export const perforceIntegrationPipeline = {
  type: 'integration',
  provider: 'perforce',
  actionTitle: t('Installing Perforce Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'installation_config',
      shortDescription: t('Configuring Perforce connection'),
      component: PerforceInstallationConfigStep,
    },
  ],
} as const satisfies PipelineDefinition;
