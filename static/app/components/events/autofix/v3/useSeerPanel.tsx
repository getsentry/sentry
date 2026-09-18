import {useCallback, useMemo} from 'react';

import {getReferrerFromBlocks} from 'sentry/components/events/autofix/autofixReferrer';
import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  useExplorerAutofix,
  type AutofixExplorerStep,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useForceBashMode} from 'sentry/components/events/autofix/v3/useForceBashMode';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import {useSeerExplorerDrawer} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';

/**
 * Everything an Autofix surface needs apart from its own chrome, so the drawer
 * and the autofix tab cannot drift in what they run or what the toolbar does.
 * Scrolling is left out on purpose: the drawer owns a scroll container, the tab
 * scrolls with the page.
 */
export function useSeerPanel({group, project}: {group: Group; project: Project}) {
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

  return {
    aiConfig,
    autofix,
    enableBashTools,
    handleCopyMarkdown,
    handleOpenSeerAgent,
    handleRestart,
    referrer,
    runState: aiAutofix.runState,
    setEnableBashTools,
    warnings: aiAutofix.warnings,
  };
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
