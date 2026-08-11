import {Fragment, useCallback, useMemo, useRef} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';

import {AutofixGithubAppPermissionsModal} from 'sentry/components/events/autofix/autofixGithubAppPermissionsModal';
import {getReferrerFromBlocks} from 'sentry/components/events/autofix/autofixReferrer';
import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerDrawerBody} from 'sentry/components/events/autofix/v3/body';
import {SeerDrawerContent} from 'sentry/components/events/autofix/v3/content';
import {SeerDrawerHeader} from 'sentry/components/events/autofix/v3/header';
import {RetryStepProvider} from 'sentry/components/events/autofix/v3/retryStepContext';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {WorkflowFileWarning} from 'sentry/components/events/autofix/v3/workflowFileWarning';
import {Placeholder} from 'sentry/components/placeholder';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {getGithubPermissionsUpdateUrl} from 'sentry/utils/integrationUtil';
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

  const handleCopyMarkdown = useHandleCopyMarkdown({aiAutofix});
  const handleRestart = useHandleRestart({aiAutofix});
  const handleOpenSeerAgent = useHandleOpenSeerAgent({aiAutofix});

  const referrer = useMemo(
    () => getReferrerFromBlocks(aiAutofix.runState?.blocks ?? []),
    [aiAutofix.runState?.blocks]
  );

  // For autoscroll, we only want to turn it on if we ever encounter a processing state.
  // If not, it indicates the users is viewing an already completed autofix, so we do
  // not want to enable autoscroll.
  const enableAutoScroll = useRef(false);
  if (aiAutofix.runState?.status === 'processing') {
    enableAutoScroll.current = true;
  }

  const {containerRef, onScrollHandler} = useAutoScroll({
    enabled: enableAutoScroll.current,
    key: aiAutofix.runState,
  });

  return (
    // The workflow-file banner points the user at the code changes card's retry
    // prompt, so both live under the same provider.
    <RetryStepProvider>
      <Stack
        className="seer-drawer-container"
        position="relative"
        height="100%"
        overflowY="hidden"
        background="secondary"
      >
        <SeerDrawerHeader
          onCopyMarkdown={handleCopyMarkdown}
          onOpenSeerAgent={handleOpenSeerAgent}
          onReset={handleRestart}
          referrer={referrer}
        />
        <AutofixWarnings warnings={aiAutofix.warnings} groupId={group.id} />
        <WorkflowFileWarning runState={aiAutofix.runState} />
        <MultiRepoPrIterationWarning runState={aiAutofix.runState} groupId={group.id} />
        <SeerDrawerBody ref={containerRef} onScroll={onScrollHandler}>
          {aiConfig.isAutofixSetupLoading ? (
            <Stack data-test-id="ai-setup-loading-indicator" gap="xl">
              <Placeholder height="10rem" />
              <Placeholder height="15rem" />
              <Placeholder height="15rem" />
            </Stack>
          ) : (
            <SeerDrawerContent group={group} autofix={aiAutofix} aiConfig={aiConfig} />
          )}
        </SeerDrawerBody>
      </Stack>
    </RetryStepProvider>
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
  const runId = aiAutofix.runState?.run_id;

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
  repo_name?: string;
};

function InstallationPermissionsButton({installationId}: {installationId: string}) {
  const {openModal} = useModal();
  const installationUrl = getGithubPermissionsUpdateUrl(installationId);

  return (
    <Button
      variant="primary"
      size="xs"
      onClick={() =>
        openModal(deps => (
          <AutofixGithubAppPermissionsModal
            {...deps}
            installationUrl={installationUrl}
            description={tct(
              'Seer had trouble talking to GitHub while running Autofix. Please update your [link:GitHub App installation settings] to grant the required permissions.',
              {link: <ExternalLink href={installationUrl} />}
            )}
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

export function MultiRepoPrIterationWarning({
  runState,
  groupId,
}: {
  groupId: string;
  runState: ExplorerAutofixState | null | undefined;
}) {
  const organization = useOrganization();
  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:${groupId}:autofix-multi-repo-pr-iteration-warning`,
    expirationDays: 7,
  });

  // Derived here rather than sent from the backend: the run state the drawer
  // already has is enough, so no new field has to cross the API boundary.
  const repoNames = Object.keys(runState?.repo_pr_states ?? {});

  if (repoNames.length <= 1 || isDismissed) {
    return null;
  }

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
          <Button
            icon={<IconClose />}
            variant="transparent"
            size="xs"
            aria-label={t('Dismiss')}
            onClick={dismiss}
          />
        }
      >
        {tct(
          "This fix opened pull requests in [repoNames]. Seer can't iterate on pull requests from a run that spans multiple repositories, so feedback on them won't be picked up.",
          {repoNames: repoNamesNode}
        )}
      </Alert>
    </Stack>
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
      <InstallationPermissionsButton installationId={installationId} />
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
              'The configured GitHub App for [repoNames] is missing permissions. Update the app and ask Seer to retry.',
              {
                repoNames: repoNamesNode,
              }
            )
          : t(
              'The configured GitHub App is missing permissions. Update the app and ask Seer to retry.'
            )}
      </Alert>
    </Stack>
  );
}
