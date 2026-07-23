import {Fragment, useMemo} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {
  collectPatches,
  getAutofixArtifactFromSection,
  isCodeChangesArtifact,
  isPrIterationBlock,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ArtifactCard} from 'sentry/components/events/autofix/v3/artifactCard';
import {ArtifactDetails} from 'sentry/components/events/autofix/v3/artifactDetails';
import {ArtifactLoadingDetails} from 'sentry/components/events/autofix/v3/artifactLoadingDetails';
import {AutofixResetPrompt} from 'sentry/components/events/autofix/v3/autofixResetPrompt';
import {
  FeedbackList,
  usePrIterationFeedback,
} from 'sentry/components/events/autofix/v3/feedbackList';
import {PrIterationFeedbackForm} from 'sentry/components/events/autofix/v3/prIterationFeedbackForm';
import {useResetAutofixStep} from 'sentry/components/events/autofix/v3/useResetAutofixStep';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {IconCode} from 'sentry/icons/iconCode';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t, tn} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

interface CodeChangesCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  groupId: string;
  section: AutofixSection;
}

function getFinalExplanation(section: AutofixSection): string | null {
  for (let i = section.blocks.length - 1; i >= 0; i--) {
    const block = section.blocks[i];
    if (!block) {
      continue;
    }
    const message = block.message;
    if (message.role === 'assistant' && message.content?.trim()) {
      return message.content.trim();
    }
  }
  return null;
}

export function CodeChangesCard({autofix, groupId, section}: CodeChangesCardProps) {
  const organization = useOrganization();
  const hasPrIterationFeature = organization.features.includes('autofix-pr-iteration');

  const isIterating =
    hasPrIterationFeature &&
    section.status === 'processing' &&
    section.blocks.some(isPrIterationBlock);

  const currentStepStart = useMemo(
    () => section.blocks.findLastIndex(block => defined(block.message.metadata?.step)),
    [section.blocks]
  );

  const {feedback, latestIterationIndex} = usePrIterationFeedback(
    section,
    autofix,
    hasPrIterationFeature
  );

  const loadingBlocks = useMemo(() => {
    if (section.status !== 'processing') {
      return [];
    }
    if (currentStepStart === -1) {
      return section.blocks;
    }
    return section.blocks.slice(currentStepStart);
  }, [section.status, section.blocks, currentStepStart]);

  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isCodeChangesArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);

  const {copy} = useCopyToClipboard();
  const markdown = useMemo(
    () => (artifact ? artifactToMarkdown(artifact) : null),
    [artifact]
  );

  const prIterationEnabled = hasPrIterationFeature;
  const hasPRs = Object.keys(autofix.runState?.repo_pr_states ?? {}).length > 0;
  const noCodingAgents =
    Object.values(autofix.runState?.coding_agents ?? {}).length === 0;

  const isResetEligible = prIterationEnabled
    ? noCodingAgents && (hasPRs || autofix.runState?.status !== 'processing')
    : noCodingAgents && !hasPRs && autofix.runState?.status !== 'processing';

  const {canReset, shouldShowReset, setShouldShowReset, handleReset} =
    useResetAutofixStep({
      autofix,
      canReset: isResetEligible,
      section,
      step: 'code_changes',
    });
  const patchesByRepo = useMemo(() => collectPatches(artifact ?? []), [artifact]);

  const explanation = useMemo(() => getFinalExplanation(section), [section]);

  const summary = useMemo(() => {
    const reposChanged = patchesByRepo.size;

    const filesChanged = new Set<string>();

    for (const [repo, patchesForRepo] of patchesByRepo.entries()) {
      for (const patch of patchesForRepo) {
        filesChanged.add(`${repo}:${patch.patch.path}`);
      }
    }

    if (reposChanged === 1) {
      return tn(
        '%s file changed in 1 repo',
        '%s files changed in 1 repo',
        filesChanged.size
      );
    }

    return t('%s files changed in %s repos', filesChanged.size, reposChanged);
  }, [patchesByRepo]);

  const showPrIterationForm = hasPRs && prIterationEnabled;
  const prIterationForm = (
    <PrIterationFeedbackForm
      autofix={autofix}
      groupId={groupId}
      runId={autofix.runState?.run_id}
      referrer="code_changes_card_reset"
      onClose={() => setShouldShowReset(false)}
    />
  );

  // The reset affordance shown inside a content branch when the user has opened
  // it: the PR-iteration feedback form when PRs exist, otherwise a free-text
  // reset prompt whose copy the branch supplies.
  function resetPrompt(prompt: string, placeholder: string): React.ReactNode {
    if (!shouldShowReset) {
      return null;
    }
    if (showPrIterationForm) {
      return prIterationForm;
    }
    return (
      <AutofixResetPrompt
        onClosePrompt={() => setShouldShowReset(false)}
        onReset={handleReset}
        placeholder={placeholder}
        prompt={prompt}
      />
    );
  }

  let title: React.ReactNode = t('Code Changes');
  if (latestIterationIndex !== null) {
    title = (
      <Flex gap="md" align="center">
        {t('Code Changes')}
        {/* `iteration_index` is zero-based; display a one-based version number. */}
        <Tag variant="muted">{t('v%s - Latest', latestIterationIndex + 1)}</Tag>
      </Flex>
    );
  }

  let content: React.ReactNode;
  if (section.status === 'processing') {
    content = (
      <Fragment>
        {/* PR iteration feedback is queued while a run is in progress, so keep
            the form available even mid-run. */}
        {shouldShowReset && showPrIterationForm && prIterationForm}
        <ArtifactLoadingDetails
          blocks={loadingBlocks}
          loadingMessage={
            isIterating ? t('Iterating on PR…') : t('Implementing changes…')
          }
        />
      </Fragment>
    );
  } else if (section.status === 'completed' && artifact && patchesByRepo.size) {
    content = (
      <Fragment>
        {resetPrompt(
          t('How can this code change be improved?'),
          t('Give seer additional context to improve this code change.')
        )}
        <ArtifactDetails>
          <Text>{summary}</Text>
        </ArtifactDetails>
        {[...patchesByRepo.entries()].map(([repo, patches]) => (
          <ArtifactDetails key={repo}>
            <Flex gap="lg">
              <Text bold>{t('Repository:')}</Text>
              <Text>{repo}</Text>
            </Flex>
            {patches.map((patch, index) => (
              <FileDiffViewer
                key={index}
                patch={patch.patch}
                showBorder
                collapsible
                defaultExpanded={artifact !== null && artifact.length <= 1}
              />
            ))}
          </ArtifactDetails>
        ))}
      </Fragment>
    );
  } else if (explanation) {
    content = (
      <ArtifactDetails gap="lg">
        <Stack gap="md">
          <Text bold>{t("Seer proposed a fix but couldn't apply it automatically")}</Text>
          <Markdown raw={explanation} />
        </Stack>
        {shouldShowReset ? (
          resetPrompt(
            t('What additional context should Seer use?'),
            t(
              'Add context that could unblock the change, e.g. the repo or files to edit.'
            )
          )
        ) : (
          <Flex>
            <Button
              variant="primary"
              icon={<IconRefresh />}
              disabled={!canReset}
              onClick={() => setShouldShowReset(true)}
            >
              {t('Add context & retry')}
            </Button>
          </Flex>
        )}
      </ArtifactDetails>
    );
  } else {
    content = (
      <ArtifactDetails>
        <Text>
          {t(
            'Seer failed to generate a code change. This one is on us. Try running it again.'
          )}
        </Text>
        <Flex>
          <Button variant="primary" icon={<IconRefresh />} onClick={() => handleReset()}>
            {t('Re-run')}
          </Button>
        </Flex>
      </ArtifactDetails>
    );
  }

  return (
    <ArtifactCard
      icon={<IconCode />}
      title={title}
      onCopy={
        markdown
          ? () => copy(markdown, {successMessage: t('Copied to clipboard.')})
          : undefined
      }
      allowReset
      onReset={canReset ? () => setShouldShowReset(true) : undefined}
    >
      <FeedbackList items={feedback} />
      {content}
    </ArtifactCard>
  );
}
