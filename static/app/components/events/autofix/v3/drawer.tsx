import {Fragment, useCallback, useMemo, useRef} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';

import {AutofixGithubAppPermissionsModal} from 'sentry/components/events/autofix/autofixGithubAppPermissionsModal';
import {getReferrerFromBlocks} from 'sentry/components/events/autofix/autofixReferrer';
import {
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerDrawerBody} from 'sentry/components/events/autofix/v3/body';
import {SeerDrawerContent} from 'sentry/components/events/autofix/v3/content';
import {SeerDrawerHeader} from 'sentry/components/events/autofix/v3/header';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
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
    pollPR: organization.features.includes('autofix-pr-iteration'),
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
  );
}

export function useHandleCopyMarkdown({
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

export function useHandleRestart({
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
