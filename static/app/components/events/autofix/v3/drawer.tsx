import {Fragment, useCallback, useMemo} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';

import {AutofixGithubAppPermissionsModal} from 'sentry/components/events/autofix/autofixGithubAppPermissionsModal';
import {getReferrerFromBlocks} from 'sentry/components/events/autofix/autofixReferrer';
import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  useExplorerAutofix,
  type AutofixExplorerStep,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerDrawerBody} from 'sentry/components/events/autofix/v3/body';
import {SeerDrawerContent} from 'sentry/components/events/autofix/v3/content';
import {SeerDrawerHeader} from 'sentry/components/events/autofix/v3/header';
import {useForceBashMode} from 'sentry/components/events/autofix/v3/useForceBashMode';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {Placeholder} from 'sentry/components/placeholder';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {useAutoScroll} from 'sentry/utils/useAutoScroll';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import {useSeerExplorerDrawer} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';

interface SeerDrawerProps {
  group: Group;
  project: Project;
}

export function SeerDrawer({group, project}: SeerDrawerProps) {
  const organization = useOrganization();
  const aiConfig = useAiConfig(group, project);
  const aiAutofix = useExplorerAutofix(group, {
    // Automated CI iteration pushes commits with no user action, so poll for both.
    pollPR:
      organization.features.includes('autofix-pr-iteration') ||
      organization.features.includes('autofix-pr-iteration-manual'),
  });
  const [enableBashTools, setEnableBashTools] = useForceBashMode();

  const autofix = useMemo(
    () => ({
      ...aiAutofix,
      startStep: (
        step: AutofixExplorerStep,
        options?: Parameters<ReturnType<typeof useExplorerAutofix>['startStep']>[1]
      ) =>
        aiAutofix.startStep(step, {
          ...options,
          enableBashTools: enableBashTools || undefined,
        }),
    }),
    [aiAutofix, enableBashTools]
  );

  const handleCopyMarkdown = useHandleCopyMarkdown({aiAutofix: autofix});
  const handleRestart = useHandleRestart({aiAutofix: autofix});
  const handleOpenSeerAgent = useHandleOpenSeerAgent({aiAutofix: autofix});

  const referrer = useMemo(
    () => getReferrerFromBlocks(aiAutofix.runState?.blocks ?? []),
    [aiAutofix.runState?.blocks]
  );

  const {containerRef, onScrollHandler} = useAutoScroll({key: aiAutofix.runState});

  return (
    <Stack
      className="seer-drawer-container"
      position="relative"
      height="100%"
      overflowY="hidden"
      background="secondary"
    >
      <SeerDrawerHeader
        enableBashTools={enableBashTools}
        onCopyMarkdown={handleCopyMarkdown}
        onEnableBashToolsChange={setEnableBashTools}
        onOpenSeerAgent={handleOpenSeerAgent}
        onReset={handleRestart}
        referrer={referrer}
      />
      <AutofixWarnings warnings={aiAutofix.warnings} groupId={group.id} />
      <SeerDrawerBody ref={containerRef} onScroll={onScrollHandler}>
        {aiConfig.isAutofixSetupLoading ? (
          <Stack data-test-id="ai-setup-loading-indicator" gap="xl">
            <Placeholder height="10rem" />
            <Placeholder height="15rem" />
            <Placeholder height="15rem" />
          </Stack>
        ) : (
          <SeerDrawerContent group={group} autofix={autofix} aiConfig={aiConfig} />
        )}
      </SeerDrawerBody>
    </Stack>
  );
}

function useHandleCopyMarkdown({
  aiAutofix,
}: {
  aiAutofix: ReturnType<typeof useExplorerAutofix>;
}): (() => void) | undefined {
  const {copy} = useCopyToClipboard();

  return useMemo(() => {
    if (!aiAutofix.runState) {
      return;
    }

    return () => {
      const markdown = getOrderedAutofixSections(aiAutofix.runState)
        .map(getAutofixArtifactFromSection)
        .filter(defined)
        .map(artifact => artifactToMarkdown(artifact))
        .filter(defined)
        .join('\n\n');
      copy(markdown, {successMessage: t('Analysis copied to clipboard.')});
    };
  }, [aiAutofix, copy]);
}

function useHandleRestart({
  aiAutofix,
}: {
  aiAutofix: ReturnType<typeof useExplorerAutofix>;
}): () => void {
  const {startStep} = aiAutofix;

  return useCallback(() => {
    startStep('root_cause');
  }, [startStep]);
}

function useHandleOpenSeerAgent({
  aiAutofix,
}: {
  aiAutofix: ReturnType<typeof useExplorerAutofix>;
}): (() => void) | undefined {
  const {openSeerExplorerDrawer} = useSeerExplorerDrawer();
  const runId = getAutofixRunId(aiAutofix.runState);

  return useMemo(() => {
    if (!defined(runId)) {
      return;
    }
    return () => openSeerExplorerDrawer({runId});
  }, [openSeerExplorerDrawer, runId]);
}

type AutofixWarning = {
  warning_type: string;
  installation_id?: string;
  installation_url?: string;
  repo_name?: string;
};

function InstallationPermissionsButton({installationUrl}: {installationUrl?: string}) {
  const {openModal} = useModal();
  return (
    <Button
      variant="primary"
      size="xs"
      onClick={() =>
        openModal(deps => (
          <AutofixGithubAppPermissionsModal
            {...deps}
            installationUrl={installationUrl}
            description={t('Seer had trouble talking to GitHub while running Autofix.')}
          />
        ))
      }
    >
      {t('Update Permissions')}
    </Button>
  );
}

function ConfigurationPermissionsButton() {
  const organization = useOrganization();
  const configurationUrl = `/settings/${organization.slug}/integrations/github/?tab=configurations`;

  return (
    <LinkButton to={configurationUrl} variant="primary" size="xs">
      {t('Update Permissions')}
    </LinkButton>
  );
}

export function AutofixWarnings({
  warnings,
  groupId,
}: {
  groupId: string;
  warnings: AutofixWarning[];
}) {
  const organization = useOrganization();
  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:${groupId}:autofix-github-permissions-warning`,
    expirationDays: 7,
  });

  if (!warnings.length || isDismissed) {
    return null;
  }

  const permissionWarnings = warnings.filter(
    w => w.warning_type === 'github_app_permissions'
  );

  if (!permissionWarnings.length) {
    return null;
  }

  const installationIds = [
    ...new Set(permissionWarnings.map(w => w.installation_id).filter(defined)),
  ];
  const [installationId] = installationIds;

  const comp =
    installationIds.length === 1 && defined(installationId) ? (
      <InstallationPermissionsButton
        installationUrl={
          permissionWarnings.find(w => w.installation_id === installationId)
            ?.installation_url
        }
      />
    ) : (
      <ConfigurationPermissionsButton />
    );

  const repoNames = [
    ...new Set(permissionWarnings.map(w => w.repo_name).filter(defined)),
  ];

  const repoNamesNode = repoNames.map((repoName, index) => (
    <Fragment key={repoName}>
      {index > 0 && ', '}
      <code>{repoName}</code>
    </Fragment>
  ));

  return (
    <Stack gap="md" padding="md 2xl 0">
      <Alert
        variant="warning"
        trailingItems={
          <Flex gap="sm" alignSelf="center">
            {comp}
            <Button
              icon={<IconClose />}
              variant="transparent"
              size="xs"
              aria-label={t('Dismiss')}
              onClick={dismiss}
            />
          </Flex>
        }
      >
        {repoNames.length
          ? tct(
              "Seer can't fix the failing CI on your pull request because the configured GitHub App for [repoNames] is missing permissions. Update the app.",
              {
                repoNames: repoNamesNode,
              }
            )
          : t(
              "Seer can't fix the failing CI on your pull request because the configured GitHub App is missing permissions. Update the app."
            )}
      </Alert>
    </Stack>
  );
}
