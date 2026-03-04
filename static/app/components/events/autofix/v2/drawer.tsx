import {useMemo} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {SeerDrawerBody} from 'sentry/components/events/autofix/drawer/drawerBody';
import {SeerDrawerHeader} from 'sentry/components/events/autofix/drawer/drawerHeader';
import {SeerDrawerNavigator} from 'sentry/components/events/autofix/drawer/drawerNavigator';
import {SeerWelcomeScreen} from 'sentry/components/events/autofix/drawer/welcomeScreen';
import {
  getArtifactsFromBlocks,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {AiSetupConfiguration} from 'sentry/components/events/autofix/v2/autofixConfigureSeer';
import {SeerDrawerContent} from 'sentry/components/events/autofix/v2/content';
import {formatArtifactsToMarkdown} from 'sentry/components/events/autofix/v2/utils';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import {useSeerOnboardingCheck} from 'sentry/utils/useSeerOnboardingCheck';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

interface SeerDrawerProps {
  event: Event;
  group: Group;
  project: Project;
}

export function SeerDrawer({event, group, project}: SeerDrawerProps) {
  const aiConfig = useAiConfig(group, project);
  const aiAutofix = useExplorerAutofix(group.id);

  const handleCopyMarkdown = useHandleCopyMarkdown({aiAutofix, group, event});
  const handleReset = useHandleReset({aiAutofix});

  return (
    <Flex
      className="seer-drawer-container"
      position="relative"
      direction="column"
      background="secondary"
    >
      <SeerDrawerHeader group={group} project={project} event={event} />
      <SeerDrawerNavigator
        project={project}
        onCopyMarkdown={handleCopyMarkdown}
        onReset={handleReset}
      />
      <SeerDrawerBody>
        <InnerSeerDrawer
          group={group}
          project={project}
          event={event}
          aiAutofix={aiAutofix}
          aiConfig={aiConfig}
        />
      </SeerDrawerBody>
    </Flex>
  );
}

interface InnerSeerDrawerProps extends SeerDrawerProps {
  aiAutofix: ReturnType<typeof useExplorerAutofix>;
  aiConfig: ReturnType<typeof useAiConfig>;
}

function InnerSeerDrawer({
  event,
  group,
  project,
  aiAutofix,
  aiConfig,
}: InnerSeerDrawerProps) {
  const organization = useOrganization();
  const {isPending, data} = useSeerOnboardingCheck();

  const seatBasedSeer = organization.features.includes('seat-based-seer-enabled');

  const noAutofixQuota =
    !aiConfig.hasAutofixQuota && organization.features.includes('seer-billing');

  if (aiConfig.isAutofixSetupLoading || (seatBasedSeer && isPending)) {
    return (
      <Flex data-test-id="ai-setup-loading-indicator" direction="column" gap="xl">
        <Placeholder height="10rem" />
        <Placeholder height="15rem" />
        <Placeholder height="15rem" />
      </Flex>
    );
  }

  if (seatBasedSeer) {
    // No easy way to add a hook for only configuring quotas.
    // So the condition here captures all the possible cases
    // that requires some kind of configuration change.
    //
    // Instead, we bundle all the configuration into 1 hook.
    //
    // If the hook is not defined, we always direct them to
    // the seer configs.
    //
    // If the hook is defined, the hook will render a different
    // component as needed to configure quotas.
    if (
      // needs to configure quota
      noAutofixQuota ||
      // needs to configure repos
      !aiConfig.seerReposLinked ||
      !data?.hasSupportedScmIntegration
    ) {
      return <AiSetupConfiguration event={event} group={group} project={project} />;
    }
  } else if (
    // Handle welcome/consent screen at the top level
    aiConfig.orgNeedsGenAiAcknowledgement ||
    noAutofixQuota
  ) {
    return <SeerWelcomeScreen group={group} project={project} event={event} />;
  }

  return (
    <SeerDrawerContent
      group={group}
      project={project}
      event={event}
      aiAutofix={aiAutofix}
      aiConfig={aiConfig}
    />
  );
}

function useHandleCopyMarkdown({
  aiAutofix,
  event,
  group,
}: {
  aiAutofix: ReturnType<typeof useExplorerAutofix>;
  event: Event;
  group: Group;
}): (() => void) | undefined {
  const {copy} = useCopyToClipboard();
  return useMemo(() => {
    if (!aiAutofix.runState) {
      return undefined;
    }

    const blocks = aiAutofix.runState?.blocks ?? [];
    const artifacts = getArtifactsFromBlocks(blocks);

    const hasArtifacts =
      !!artifacts.root_cause?.data ||
      !!artifacts.solution?.data ||
      !!artifacts.impact_assessment?.data ||
      !!artifacts.triage?.data;

    if (!hasArtifacts) {
      return undefined;
    }

    return () => {
      const markdownText = formatArtifactsToMarkdown(
        artifacts as Record<string, {data: Record<string, unknown> | null}>,
        group,
        event
      );
      if (!markdownText.trim()) {
        return;
      }
      copy(markdownText, {successMessage: t('Analysis copied to clipboard.')});
    };
  }, [aiAutofix, group, event, copy]);
}

function useHandleReset({
  aiAutofix,
}: {
  aiAutofix: ReturnType<typeof useExplorerAutofix>;
}): (() => void) | undefined {
  return useMemo(() => {
    if (!aiAutofix.runState) {
      return undefined;
    }
    return aiAutofix.reset;
  }, [aiAutofix]);
}
