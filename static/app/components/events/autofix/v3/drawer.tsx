import {useCallback, useMemo} from 'react';

import {Flex} from '@sentry/scraps/layout';

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
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

interface SeerDrawerProps {
  event: Event;
  group: Group;
  project: Project;
}

export function SeerDrawer({group, project}: SeerDrawerProps) {
  const aiConfig = useAiConfig(group, project);
  const aiAutofix = useExplorerAutofix(group.id);

  const handleCopyMarkdown = useHandleCopyMarkdown({aiAutofix});
  const handleRestart = useHandleRestart({aiAutofix});

  return (
    <Flex
      className="seer-drawer-container"
      position="relative"
      height="100%"
      overflowY="hidden"
      direction="column"
      background="secondary"
    >
      <SeerDrawerHeader onCopyMarkdown={handleCopyMarkdown} onReset={handleRestart} />
      <SeerDrawerBody>
        {aiConfig.isAutofixSetupLoading ? (
          <Flex data-test-id="ai-setup-loading-indicator" direction="column" gap="xl">
            <Placeholder height="10rem" />
            <Placeholder height="15rem" />
            <Placeholder height="15rem" />
          </Flex>
        ) : (
          <SeerDrawerContent group={group} autofix={aiAutofix} aiConfig={aiConfig} />
        )}
      </SeerDrawerBody>
    </Flex>
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
      return undefined;
    }

    return () => {
      const markdown = getOrderedAutofixSections(aiAutofix.runState)
        .map(getAutofixArtifactFromSection)
        .filter(defined)
        .map(artifactToMarkdown)
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
