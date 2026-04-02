import {useCallback} from 'react';

import {Avatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {HookOrDefault} from 'sentry/components/hookOrDefault';
import {t, tn} from 'sentry/locale';
import type {ScmGithubMultiOrgInstallProps} from 'sentry/types/hooks';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

import type {OAuthCallbackData} from './shared/oauthLoginStep';
import {OAuthLoginStep} from './shared/oauthLoginStep';
import {useRedirectPopupStep} from './shared/useRedirectPopupStep';
import type {PipelineDefinition, PipelineStepProps} from './types';
import {pipelineComplete} from './types';

export interface InstallationInfo {
  avatarUrl: string;
  githubAccount: string;
  installationId: string;
  count?: number | null;
}

interface OrgSelectionStepData {
  installAppUrl?: string;
  installationInfo?: InstallationInfo[];
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

export const NEW_INSTALL_KEY = '_new_install';

export function buildInstallationMenuItems(
  installations: InstallationInfo[],
  options?: {newInstallDisabled?: boolean}
) {
  return [
    ...installations.map(inst => ({
      key: inst.installationId,
      leadingItems: (
        <Avatar
          size={24}
          type="upload"
          identifier={inst.installationId}
          uploadUrl={inst.avatarUrl}
          name={inst.githubAccount}
        />
      ),
      label: `github.com/${inst.githubAccount}`,
      details: inst.count
        ? tn(
            'Connected to %s other Sentry organization',
            'Connected to %s other Sentry organizations',
            inst.count
          )
        : undefined,
    })),
    {
      key: NEW_INSTALL_KEY,
      label: t('Install on a new GitHub organization'),
      disabled: options?.newInstallDisabled,
    },
  ];
}

function DefaultGitHubMultiOrgInstall({
  installations,
  onSelectInstallation,
  onNewInstall,
  isDisabled,
  newInstallDisabled,
  popupBlockedNotice,
}: ScmGithubMultiOrgInstallProps) {
  const menuItems = buildInstallationMenuItems(installations, {newInstallDisabled});

  return (
    <Stack gap="lg" align="start">
      {popupBlockedNotice}
      <DropdownMenu
        triggerLabel={t('Select GitHub organization')}
        items={menuItems}
        isDisabled={isDisabled}
        onAction={key => {
          if (key === NEW_INSTALL_KEY) {
            onNewInstall();
          } else {
            onSelectInstallation(key as string);
          }
        }}
      />
    </Stack>
  );
}

const GitHubMultiOrgInstall = HookOrDefault({
  hookName: 'component:scm-github-multi-org-install',
  defaultComponent: DefaultGitHubMultiOrgInstall,
});

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

  const {openPopup, isWaitingForCallback, popupStatus} = useRedirectPopupStep({
    redirectUrl: stepData.installAppUrl,
    onCallback: handleInstallCallback,
  });

  // TODO(epurkhiser): Once we remove the legacy django views the function that
  // generates this sentinel "Integrate with a new github organization" can be
  // changed to not add this and we can drop this value here also
  const existingInstallations = installations.filter(
    inst => inst.installationId !== '-1'
  );

  if (existingInstallations.length === 0) {
    return (
      <FreshInstallSteps
        isAdvancing={isAdvancing}
        isWaitingForCallback={isWaitingForCallback}
        popupBlockedNotice={
          popupStatus === 'failed-to-open' ? <PopupBlockedNotice /> : undefined
        }
        installDisabled={!stepData.installAppUrl}
        onInstall={openPopup}
      />
    );
  }

  return (
    <Stack gap="lg" align="start">
      <Text>
        {t(
          "Select the GitHub organization you'd like to connect to Sentry, or install the Sentry GitHub App on a GitHub organization that does not already have the app installed."
        )}
      </Text>
      <GitHubMultiOrgInstall
        installations={existingInstallations}
        onSelectInstallation={installationId =>
          advance({chosenInstallationId: installationId})
        }
        onNewInstall={openPopup}
        isDisabled={isAdvancing}
        newInstallDisabled={!stepData.installAppUrl}
        popupBlockedNotice={
          popupStatus === 'failed-to-open' ? <PopupBlockedNotice /> : undefined
        }
      />
    </Stack>
  );
}

function FreshInstallSteps({
  isAdvancing,
  isWaitingForCallback,
  popupBlockedNotice,
  installDisabled,
  onInstall,
}: {
  installDisabled: boolean;
  isAdvancing: boolean;
  isWaitingForCallback: boolean;
  onInstall: () => void;
  popupBlockedNotice?: React.ReactNode;
}) {
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
        <Button size="sm" onClick={onInstall}>
          {t('Reopen installation window')}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" align="start">
      <Text>
        {t('Install the Sentry GitHub App on a GitHub organization to get started.')}
      </Text>
      {popupBlockedNotice}
      <Button size="sm" priority="primary" onClick={onInstall} disabled={installDisabled}>
        {t('Install GitHub App')}
      </Button>
    </Stack>
  );
}

function PopupBlockedNotice() {
  return (
    <Text variant="danger" size="sm">
      {t(
        'The installation popup was blocked by your browser. Please ensure popups are allowed and try again.'
      )}
    </Text>
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
