import {Fragment, useEffect, useMemo} from 'react';
import {IconCode} from '@sentry/icons/code';
import {IconRefresh} from '@sentry/icons/refresh';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useAutofixCreditsDisabled} from 'sentry/components/events/autofix/autofixCredits';
import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {hasCreatedPullRequests} from 'sentry/components/events/autofix/pullRequests';
import {
  collectPatches,
  getAutofixArtifactFromSection,
  getOutOfCreditsStep,
  isCodeChangesArtifact,
  isPrIterationBlock,
  isPrIterationPaused,
  isSingleRunAutofix,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {Placeholder} from 'sentry/components/placeholder';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {OUT_OF_CREDITS_STEP_MESSAGE} from 'sentry/components/seer/outOfCredits/messages';
import {useOutOfCreditsRetry} from 'sentry/components/seer/outOfCredits/useOutOfCreditsRetry';
import {t, tn} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';
import type {ExplorerFilePatch} from 'sentry/views/seerExplorer/types';

import {ArtifactCard} from './artifactCard';
import {ArtifactDetails} from './artifactDetails';
import {ArtifactLoadingDetails, ArtifactPartialDetails} from './artifactLoadingDetails';
import {AutofixResetPrompt} from './autofixResetPrompt';
import {FeedbackList, usePrIterationFeedback} from './feedbackList';
import {OutOfCreditsStatus} from './outOfCreditsStatus';
import {
  PR_ITERATION_PAUSED_TOOLTIP,
  PrIterationFeedbackForm,
} from './prIterationFeedbackForm';
import {usePullRequestPatches} from './usePullRequestPatches';
import {useResetAutofixStep} from './useResetAutofixStep';
import {useRethinkInChat} from './useRethinkInChat';
import {useRerunSingleRun} from './useToggleSingleRunChat';
import {artifactToMarkdown} from './utils';

interface CodeChangesCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  groupId: string;
  section: AutofixSection;
}

const MAX_AUTO_EXPANDED_DIFF_LINES = 30;

type RepoChanges =
  | {status: 'pending' | 'pushing'}
  | {patches: ExplorerFilePatch[]; pushFailed: boolean; status: 'ready'};

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
  const location = useLocation();
  const navigate = useNavigate();
  const hasPinToPrHeadFeature = organization.features.includes(
    'autofix-pr-iteration-pin-to-pr-head'
  );

  const isIterating =
    section.status === 'processing' && section.blocks.some(isPrIterationBlock);

  const currentStepStart = useMemo(
    () => section.blocks.findLastIndex(block => defined(block.message.metadata?.step)),
    [section.blocks]
  );

  // A PR iteration that ends without a diff is the agent's answer to the
  // feedback (e.g. a CI failure unrelated to the PR), not a fix that failed to
  // apply, so there is nothing to retry.
  const latestStepBlock = section.blocks[currentStepStart];
  const isLatestStepPrIteration =
    defined(latestStepBlock) && isPrIterationBlock(latestStepBlock);

  const {feedback, latestIterationIndex} = usePrIterationFeedback(section, autofix);

  const isSingleRun = isSingleRunAutofix(autofix.runState);
  const stoppedStep = getOutOfCreditsStep(section);
  const isOutOfCredits = defined(stoppedStep);
  const outOfCreditsRetry = useOutOfCreditsRetry(
    // A single run is retried with a new one, which starts at the root cause.
    isSingleRun ? 'root_cause' : (stoppedStep ?? 'code_changes'),
    {
      billingFeature: isSingleRun ? undefined : autofix.runState?.billing_feature,
      enabled: isOutOfCredits,
    }
  );

  // The blocks of the step that is running, or that stopped for credits.
  const currentStepBlocks = useMemo(() => {
    if (section.status !== 'processing' && !isOutOfCredits) {
      return [];
    }
    if (currentStepStart === -1) {
      return section.blocks;
    }
    return section.blocks.slice(currentStepStart);
  }, [section.status, section.blocks, currentStepStart, isOutOfCredits]);

  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isCodeChangesArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);

  // A step that stopped for credits keeps the diff it got to, which is not
  // the finished artifact, so it can't be copied or turned into a PR.
  const partialArtifact = useMemo(
    () =>
      isOutOfCredits ? (section.artifacts.findLast(isCodeChangesArtifact) ?? null) : null,
    [isOutOfCredits, section.artifacts]
  );

  const {copy} = useCopyToClipboard();
  const singleRunRerun = useRerunSingleRun(autofix, {
    enabled: isSingleRun && section.status === 'error',
  });

  const hasPRs = Object.keys(autofix.runState?.repo_pr_states ?? {}).length > 0;
  const hasFailedOnlyPRs =
    hasPRs && !hasCreatedPullRequests(autofix.runState?.repo_pr_states);
  const noCodingAgents =
    Object.values(autofix.runState?.coding_agents ?? {}).length === 0;

  const isPaused = isPrIterationPaused(autofix.runState);

  // Once a PR exists, reset opens the PR iteration form, so it stays available
  // while an iteration is processing.
  const isResetAvailable =
    !isPaused &&
    !hasFailedOnlyPRs &&
    noCodingAgents &&
    (hasPRs || autofix.runState?.status !== 'processing');
  // A step that stopped for credits fails the same way until the organization
  // can afford it again.
  const isResetEligible = isResetAvailable && !outOfCreditsRetry.disabled;

  const {canReset, shouldShowReset, setShouldShowReset, handleReset} =
    useResetAutofixStep({
      autofix,
      canReset: isResetEligible,
      initialShouldShowReset:
        isResetEligible && location.query.seerDrawerAction === 'retry_code_changes',
      section,
      step: 'code_changes',
    });

  useEffect(() => {
    if (!shouldShowReset || location.query.seerDrawerAction !== 'retry_code_changes') {
      return;
    }
    navigate(
      {
        pathname: location.pathname,
        query: {...location.query, seerDrawerAction: undefined},
      },
      {replace: true, preventScrollReset: true}
    );
  }, [location, navigate, shouldShowReset]);

  const patchesByRepo = useMemo(
    () => collectPatches(artifact ?? partialArtifact ?? []),
    [artifact, partialArtifact]
  );

  // A pinned iteration measures its edits from the PR's head, so the run's patches
  // only hold what the iterations changed. Show each PR's diff on the provider instead.
  const pullRequestPatches = usePullRequestPatches({
    enabled:
      hasPinToPrHeadFeature &&
      section.status === 'completed' &&
      section.blocks.some(isPrIterationBlock),
    organizationSlug: organization.slug,
    runState: autofix.runState,
  });

  const changesByRepo = useMemo(() => {
    const changes = new Map<string, RepoChanges>(
      Array.from(patchesByRepo, ([repo, patches]) => [
        repo,
        {status: 'ready', patches, pushFailed: false},
      ])
    );
    for (const [repo, result] of pullRequestPatches) {
      if (result.status === 'pending' || result.status === 'pushing') {
        changes.set(repo, {status: result.status});
      } else if (result.status === 'success') {
        changes.set(repo, {
          status: 'ready',
          patches: result.patches,
          pushFailed: result.pushFailed,
        });
      }
      // Otherwise keep the run's patches, which beat showing nothing.
    }
    return changes;
  }, [patchesByRepo, pullRequestPatches]);

  const markdown = useMemo(() => {
    if (!artifact || !pullRequestPatches.size) {
      return artifact ? artifactToMarkdown(artifact) : null;
    }
    const patches: ExplorerFilePatch[] = [];
    for (const changes of changesByRepo.values()) {
      // Don't copy a partial diff while any repo is still loading or pushing.
      if (changes.status !== 'ready') {
        return null;
      }
      patches.push(...changes.patches);
    }
    return artifactToMarkdown(patches);
  }, [artifact, changesByRepo, pullRequestPatches.size]);

  const shouldExpandDiffs = useMemo(() => {
    let lineCount = 0;

    for (const changes of changesByRepo.values()) {
      if (changes.status !== 'ready') {
        continue;
      }
      for (const patch of changes.patches) {
        for (const hunk of patch.patch.hunks) {
          lineCount += hunk.lines.length;
        }
      }
    }

    return lineCount <= MAX_AUTO_EXPANDED_DIFF_LINES;
  }, [changesByRepo]);

  const explanation = useMemo(() => getFinalExplanation(section), [section]);

  const summary = useMemo(() => {
    const reposChanged = changesByRepo.size;

    const filesChanged = new Set<string>();

    for (const [repo, changes] of changesByRepo.entries()) {
      // The counts would be wrong until every PR's diff has loaded.
      if (changes.status !== 'ready') {
        return null;
      }
      for (const patch of changes.patches) {
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
  }, [changesByRepo]);

  const showPrIterationForm = hasPRs;
  // The form starts another PR iteration, the same billable step as the one at
  // the bottom of the drawer, so it is held on the same check.
  const prIterationCreditsDisabled = useAutofixCreditsDisabled('pr_iteration', {
    billingFeature: autofix.runState?.billing_feature,
    enabled: shouldShowReset && showPrIterationForm,
  });

  const rethinkInChat = useRethinkInChat({
    prompt: t('How can this code change be improved?'),
    step: 'code_changes',
  });
  // Feedback on an open PR goes through the PR iteration form, not the chat.
  const resetInChat = showPrIterationForm ? undefined : rethinkInChat;
  const prIterationForm = (
    <PrIterationFeedbackForm
      autofix={autofix}
      groupId={groupId}
      runId={getAutofixRunId(autofix.runState)}
      referrer="code_changes_card_reset"
      onClose={() => setShouldShowReset(false)}
      disabled={prIterationCreditsDisabled}
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

  const diffDetails = (
    <Fragment>
      {summary && (
        <ArtifactDetails>
          <Text>{summary}</Text>
        </ArtifactDetails>
      )}
      {Array.from(changesByRepo.entries(), ([repo, changes]) => (
        <ArtifactDetails key={repo}>
          <Flex gap="lg">
            <Text bold>{t('Repository:')}</Text>
            <Text>{repo}</Text>
          </Flex>
          {changes.status === 'pushing' && (
            <Text variant="muted">
              {t('Pushing the latest changes to the pull request…')}
            </Text>
          )}
          {changes.status === 'pending' && <Placeholder height="4rem" />}
          {changes.status === 'ready' && changes.pushFailed && (
            <Alert variant="warning">
              {t(
                "We couldn't push the latest changes. This is the pull request's diff without them."
              )}
            </Alert>
          )}
          {changes.status === 'ready' &&
            changes.patches.map((patch, index) => (
              <FileDiffViewer
                key={index}
                patch={patch.patch}
                fileUrl={patch.code_url}
                showBorder
                collapsible
                defaultExpanded={shouldExpandDiffs}
              />
            ))}
        </ArtifactDetails>
      ))}
    </Fragment>
  );

  let content: React.ReactNode;
  if (section.status === 'processing') {
    content = (
      <Fragment>
        {/* PR iteration feedback is queued while a run is in progress, so keep
            the form available even mid-run. */}
        {shouldShowReset && showPrIterationForm && prIterationForm}
        <ArtifactLoadingDetails
          blocks={currentStepBlocks}
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
          t('Give Seer additional context to improve this code change.')
        )}
        {diffDetails}
      </Fragment>
    );
  } else if (isOutOfCredits) {
    let retry: React.ReactNode = null;
    if (shouldShowReset) {
      retry = resetPrompt(
        t('What additional context should Seer use?'),
        t('Add context that could unblock the change, e.g. the repo or files to edit.')
      );
    } else if (isSingleRun) {
      // Single runs reject step restarts, so this starts a new one.
      retry = (
        <Flex>
          <Button
            variant="primary"
            icon={<IconRefresh />}
            disabled={singleRunRerun.disabled}
            tooltipProps={{title: outOfCreditsRetry.tooltip}}
            onClick={() => singleRunRerun.rerun()}
          >
            {t('Re-run')}
          </Button>
        </Flex>
      );
    } else if (isResetAvailable) {
      // An iteration is retried with feedback, through the PR iteration form.
      retry = (
        <Flex>
          <Button
            variant="primary"
            icon={<IconRefresh />}
            disabled={!canReset}
            tooltipProps={{title: outOfCreditsRetry.tooltip}}
            onClick={() =>
              stoppedStep === 'pr_iteration' ? setShouldShowReset(true) : handleReset()
            }
          >
            {stoppedStep === 'pr_iteration' ? t('Add context & retry') : t('Re-run')}
          </Button>
        </Flex>
      );
    }
    content = (
      <Fragment>
        <ArtifactPartialDetails blocks={currentStepBlocks} />
        {patchesByRepo.size > 0 && diffDetails}
        <OutOfCreditsStatus message={OUT_OF_CREDITS_STEP_MESSAGE[stoppedStep]}>
          {retry}
        </OutOfCreditsStatus>
      </Fragment>
    );
  } else if (explanation && isLatestStepPrIteration) {
    content = (
      <Fragment>
        {resetPrompt(
          t('How can this code change be improved?'),
          t('Give Seer additional context to improve this code change.')
        )}
        <ArtifactDetails>
          <SeerMarkdown raw={explanation} />
        </ArtifactDetails>
      </Fragment>
    );
  } else if (explanation) {
    content = (
      <ArtifactDetails gap="lg">
        <Stack gap="md">
          <Text bold>{t("Seer proposed a fix but couldn't apply it automatically")}</Text>
          <SeerMarkdown raw={explanation} />
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
      <ArtifactDetails gap="lg">
        <Text>
          {t(
            'Seer failed to generate a code change. This one is on us. Try running it again.'
          )}
        </Text>
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
              disabled={isSingleRun ? singleRunRerun.disabled : !canReset}
              onClick={isSingleRun ? () => singleRunRerun.rerun() : () => handleReset()}
            >
              {t('Re-run')}
            </Button>
          </Flex>
        )}
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
      // Single runs reject step restarts; people redo the fix by replying in the chat.
      allowReset={!isSingleRun}
      onReset={canReset ? (resetInChat ?? (() => setShouldShowReset(true))) : undefined}
      resetInChat={defined(resetInChat)}
      resetTooltip={isPaused ? PR_ITERATION_PAUSED_TOOLTIP : outOfCreditsRetry.tooltip}
    >
      <FeedbackList items={feedback} />
      {content}
    </ArtifactCard>
  );
}
