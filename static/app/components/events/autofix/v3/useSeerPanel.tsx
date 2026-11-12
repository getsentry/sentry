import {useCallback, useMemo} from 'react';

import {getReferrerFromBlocks} from 'sentry/components/events/autofix/autofixReferrer';
import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import {useSeerExplorerDrawer} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';

import {artifactToMarkdown} from './utils';

/**
 * Everything an Autofix surface needs apart from its own chrome, so the drawer
 * and the autofix tab cannot drift in what they run or what the toolbar does.
 * Scrolling is left out on purpose: the drawer owns a scroll container, the tab
 * scrolls with the page.
 */
export function useSeerPanel({group, project}: {group: Group; project: Project}) {
  const aiConfig = useAiConfig(group, project);
  const aiAutofix = useExplorerAutofix(group, {
    // Automated CI iteration can push commits without any user action.
    pollPR: true,
  });

  const handleCopyMarkdown = useHandleCopyMarkdown({aiAutofix});
  const handleRestart = useHandleRestart({aiAutofix});
  const handleOpenSeerAgent = useHandleOpenSeerAgent({aiAutofix});

  const referrer = useMemo(
    () => getReferrerFromBlocks(aiAutofix.runState?.blocks ?? []),
    [aiAutofix.runState?.blocks]
  );

  return {
    aiConfig,
    autofix: aiAutofix,
    handleCopyMarkdown,
    handleOpenSeerAgent,
    handleRestart,
    referrer,
    runState: aiAutofix.runState,
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
