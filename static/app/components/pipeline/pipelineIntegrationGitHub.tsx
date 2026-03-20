import {useCallback} from 'react';

import {Avatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

import type {OAuthCallbackData} from './shared/oauthLoginStep';
import {OAuthLoginStep} from './shared/oauthLoginStep';
import {useRedirectPopupStep} from './shared/useRedirectPopupStep';
import type {PipelineDefinition, PipelineStepProps} from './types';
import {pipelineComplete} from './types';

interface OrgSelectionStepData {
  installAppUrl?: string;
  installationInfo?: Array<{
    avatarUrl: string;
    githubAccount: string;
    installationId: string;
    count?: number | null;
  }>;
}

interface OrgSelectionAdvanceData {
  chosenInstallationId?: string;
  installationId?: string;
}

function GitHubOAuthLoginStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<
  {oauthUrl?: string},
  {code: string; state: string; installationId?: string}
>) {
  const handleOAuthCallback = useCallback(
    (data: OAuthCallbackData) => {
      advance({
        code: data.code,
        state: data.state,
        installationId: data.rest.installation_id,
      });
    },
    [advance]
  );

  return (
    <OAuthLoginStep
      oauthUrl={stepData.oauthUrl}
      isLoading={isAdvancing}
      serviceName="GitHub"
      onOAuthCallback={handleOAuthCallback}
    />
  );
}

const NEW_INSTALL_KEY = '_new_install';

function OrgSelectionStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<OrgSelectionStepData, OrgSelectionAdvanceData>) {
  const installations = stepData.installationInfo ?? [];

  const handleInstallCallback = useCallback(
    (data: Record<string, unknown>) => {
      advance({
        installationId: data.installation_id as string,
      });
    },
    [advance]
  );

  const {reopenPopup, isWaitingForCallback} = useRedirectPopupStep({
    redirectUrl: stepData.installAppUrl,
    autoOpen: false,
    onCallback: handleInstallCallback,
  });

  // Filter out the "-1" sentinel — we handle "new org" with a dedicated menu item
  const existingInstallations = installations.filter(
    inst => inst.installationId !== '-1'
  );

  if (isAdvancing) {
    return (
      <Stack gap="lg" align="start">
        <Text>
          {t(
            'Complete the installation in the popup window. Once finished, this page will update automatically.'
          )}
        </Text>
        <Button size="sm" disabled>
          {t('Completing...')}
        </Button>
      </Stack>
    );
  }

  if (isWaitingForCallback) {
    return (
      <Stack gap="lg" align="start">
        <Text>
          {t(
            'Complete the installation in the popup window. Once finished, this page will update automatically.'
          )}
        </Text>
        <Button size="sm" onClick={reopenPopup}>
          {t('Reopen installation window')}
        </Button>
      </Stack>
    );
  }

  // No existing installations — show install button directly
  if (existingInstallations.length === 0) {
    return (
      <Stack gap="lg" align="start">
        <Text>
          {t(
            "Select the GitHub organization you'd like to connect to Sentry, or install the Sentry GitHub App on a new organization."
          )}
        </Text>
        <Button
          size="sm"
          priority="primary"
          onClick={reopenPopup}
          disabled={!stepData.installAppUrl}
        >
          {t('Install GitHub App')}
        </Button>
      </Stack>
    );
  }

  const menuItems = [
    ...existingInstallations.map(inst => ({
      key: inst.installationId,
      leadingItems: (
        <Avatar
          size={16}
          type="upload"
          identifier={inst.installationId}
          uploadUrl={inst.avatarUrl}
          name={inst.githubAccount}
        />
      ),
      label: inst.githubAccount,
      details: inst.count
        ? t('Connected to %s other Sentry organizations', inst.count)
        : undefined,
      textValue: inst.githubAccount,
    })),
    {
      key: NEW_INSTALL_KEY,
      leadingItems: <IconAdd size="sm" />,
      label: t('Install on a new GitHub organization'),
      textValue: t('Install on a new GitHub organization'),
    },
  ];

  return (
    <Stack gap="lg" align="start">
      <Text>
        {t(
          "Select the GitHub organization you'd like to connect to Sentry, or install the Sentry GitHub App on a new organization."
        )}
      </Text>
      <DropdownMenu
        triggerLabel={t('Select GitHub organization')}
        items={menuItems}
        isDisabled={isAdvancing}
        onAction={key => {
          if (key === NEW_INSTALL_KEY) {
            reopenPopup();
          } else {
            advance({chosenInstallationId: key as string});
          }
        }}
      />
    </Stack>
  );
}

export const githubIntegrationPipeline = {
  type: 'integration',
  provider: 'github',
  actionTitle: t('Installing GitHub Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  steps: [
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing via GitHub OAuth flow'),
      component: GitHubOAuthLoginStep,
    },
    {
      stepId: 'org_selection',
      shortDescription: t('Installing GitHub Application'),
      component: OrgSelectionStep,
    },
  ],
} as const satisfies PipelineDefinition;
