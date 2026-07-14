import {Fragment, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Markdown} from '@sentry/scraps/markdown';
import {Prose, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  collectPatches,
  getAutofixArtifactFromSection,
  isCodeChangesArtifact,
  isPrIterationBlock,
  type AutofixSection,
  type RawFeedback,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ArtifactCard} from 'sentry/components/events/autofix/v3/artifactCard';
import {ArtifactDetails} from 'sentry/components/events/autofix/v3/artifactDetails';
import {ArtifactLoadingDetails} from 'sentry/components/events/autofix/v3/artifactLoadingDetails';
import {AutofixResetPrompt} from 'sentry/components/events/autofix/v3/autofixResetPrompt';
import {PrIterationFeedbackForm} from 'sentry/components/events/autofix/v3/prIterationFeedbackForm';
import {useResetAutofixStep} from 'sentry/components/events/autofix/v3/useResetAutofixStep';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {IconClock} from 'sentry/icons/iconClock';
import {IconCode} from 'sentry/icons/iconCode';
import {IconGithub} from 'sentry/icons/iconGithub';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t, tn} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils/defined';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

interface CodeChangesCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  groupId: string;
  section: AutofixSection;
}

/**
 * - `processed`: the iteration it drove has finished and its changes are pushed.
 * - `in_progress`: it's driving the iteration currently being processed.
 * - `queued`: submitted while a run was processing, not yet picked up.
 */
type FeedbackStatus = 'processed' | 'in_progress' | 'queued';

interface ParsedBaseFeedback {
  text: string;
  timestamp?: string;
}

interface UserUiFeedback extends ParsedBaseFeedback {
  sourceType: 'user-ui';
  user?: User | null;
}

interface GithubPrCommentFeedback extends ParsedBaseFeedback {
  commentUrl: string;
  sourceType: 'github-pr-comment';
  githubUsername?: string;
}

// What `parseFeedback` can produce from the stored JSON alone.
type ParsedFeedback = UserUiFeedback | GithubPrCommentFeedback;

// A parsed feedback enriched with the iteration context the caller supplies.
type IterationFeedback = ParsedFeedback & {
  iterationIndex: number;
  status: FeedbackStatus;
};

function parseFeedbackItem(parsed: RawFeedback): ParsedFeedback | null {
  // `ui_text` is the short display label the backend derives per source; fall
  // back to the raw prompt `text` for feedback serialized before it existed.
  const base = {
    text: parsed.ui_text ?? parsed.text,
    timestamp: parsed.timestamp,
  };
  const source = parsed.source;
  switch (source?.type) {
    case 'user-ui':
      return {...base, sourceType: 'user-ui', user: source.user};
    case 'github-pr-comment': {
      const commentUrl = source.comment?.html_url;
      if (!commentUrl) {
        return null;
      }
      return {
        ...base,
        sourceType: 'github-pr-comment',
        githubUsername: source.comment?.user?.login,
        commentUrl,
      };
    }
    default:
      return null;
  }
}

function parseFeedback(raw: string): ParsedFeedback[] {
  const parsed: RawFeedback | RawFeedback[] = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map(parseFeedbackItem).filter(defined);
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

  // PR iterations are folded into this section's blocks. Surface the feedback
  // that drove each one — the cumulative diff is already merged into the
  // section's code-change artifact by getOrderedAutofixSections. Feedback on a
  // block at/after the current step marker drives the iteration still running
  // (when the section is processing); everything earlier is already pushed.
  const blockFeedback = useMemo<IterationFeedback[]>(() => {
    if (!hasPrIterationFeature) {
      return [];
    }

    return section.blocks.flatMap((block, blockIndex) => {
      if (!isPrIterationBlock(block)) {
        return [];
      }

      const metadata = block.message.metadata;
      const value = metadata?.feedback;
      const iterationIndex = metadata?.iteration_index;

      if (!value || iterationIndex === undefined) {
        return [];
      }

      const status: FeedbackStatus =
        section.status === 'processing' && blockIndex >= currentStepStart
          ? 'in_progress'
          : 'processed';

      return parseFeedback(value).map(parsed => ({
        ...parsed,
        iterationIndex: Number(iterationIndex),
        status,
      }));
    });
  }, [section.blocks, section.status, currentStepStart, hasPrIterationFeature]);

  const latestIterationIndex = useMemo(
    () =>
      blockFeedback.reduce<number | null>(
        (max, item) =>
          max === null ? item.iterationIndex : Math.max(max, item.iterationIndex),
        null
      ),
    [blockFeedback]
  );

  // Feedback submitted while this run is processing that hasn't been picked up
  // and folded into a block yet. It will become the next iteration.
  const queuedFeedback = useMemo<IterationFeedback[]>(() => {
    if (!hasPrIterationFeature) {
      return [];
    }

    return (autofix.runState?.queued_feedback ?? []).flatMap(raw => {
      const parsed = parseFeedbackItem(raw);
      if (!parsed) {
        return [];
      }

      return [
        {
          ...parsed,
          iterationIndex: (latestIterationIndex ?? -1) + 1,
          status: 'queued' as const,
        },
      ];
    });
  }, [autofix.runState?.queued_feedback, latestIterationIndex, hasPrIterationFeature]);

  const feedback = useMemo(
    () => [...blockFeedback, ...queuedFeedback].reverse(),
    [blockFeedback, queuedFeedback]
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

  const isProcessing = section.status === 'processing';

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
  if (isProcessing) {
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
  } else if (artifact && patchesByRepo.size) {
    let resetSection: React.ReactNode = null;
    if (shouldShowReset) {
      if (showPrIterationForm) {
        resetSection = prIterationForm;
      } else {
        resetSection = (
          <AutofixResetPrompt
            onClosePrompt={() => setShouldShowReset(false)}
            onReset={handleReset}
            placeholder={t('Give seer additional context to improve this code change.')}
            prompt={t('How can this code change be improved?')}
          />
        );
      }
    }

    content = (
      <Fragment>
        {resetSection}
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
    let resetSection: React.ReactNode;
    if (!shouldShowReset) {
      resetSection = (
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
      );
    } else if (showPrIterationForm) {
      resetSection = prIterationForm;
    } else {
      resetSection = (
        <AutofixResetPrompt
          onClosePrompt={() => setShouldShowReset(false)}
          onReset={handleReset}
          placeholder={t(
            'Add context that could unblock the change, e.g. the repo or files to edit.'
          )}
          prompt={t('What additional context should Seer use?')}
        />
      );
    }

    content = (
      <ArtifactDetails gap="lg">
        <Stack gap="md">
          <Text bold>{t("Seer proposed a fix but couldn't apply it automatically")}</Text>
          <Markdown raw={explanation} />
        </Stack>
        {resetSection}
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
      {feedback.length > 0 && (
        <ArtifactDetails>
          <Text bold>{t('Feedback')}</Text>
          {feedback.map((item, index) => (
            <FeedbackItem key={`${item.iterationIndex}-${index}`} item={item} />
          ))}
        </ArtifactDetails>
      )}
      {content}
    </ArtifactCard>
  );
}

function FeedbackAttribution({item}: {item: IterationFeedback}) {
  switch (item.sourceType) {
    case 'github-pr-comment':
      return (
        <Tooltip title={item.githubUsername ?? t('GitHub PR comment')} skipWrapper>
          <ExternalLink href={item.commentUrl}>
            <Flex align="center">
              <IconGithub size="md" />
            </Flex>
          </ExternalLink>
        </Tooltip>
      );
    case 'user-ui':
      return item.user ? <UserAvatar size={16} user={item.user} hasTooltip /> : null;
    default:
      return null;
  }
}

function FeedbackStatusIcon({status}: {status: FeedbackStatus}) {
  switch (status) {
    case 'processed':
      return (
        <Tooltip title={t('Changes from this feedback have been pushed')}>
          <Tag variant="success" icon={<IconCheckmark />} />
        </Tooltip>
      );
    case 'in_progress':
      return (
        <Tooltip title={t('This feedback is being processed')}>
          <LoadingIndicator size={14} style={{margin: 0}} />
        </Tooltip>
      );
    case 'queued':
      return <Tag variant="muted" icon={<IconClock />} />;
    default:
      return null;
  }
}

const FeedbackProse = styled(Prose)<{muted?: boolean}>`
  ${p =>
    p.muted
      ? css`
          color: ${p.theme.tokens.content.secondary};
        `
      : ''}
`;

function FeedbackItem({item}: {item: IterationFeedback}) {
  const isQueued = item.status === 'queued';
  return (
    <Flex gap="md" align="start" justify="between">
      <Flex gap="md" align="start" flex="1" minWidth={0}>
        <Flex align="center" gap="md" height="1lh">
          <Flex align="center" justify="center" width="28px">
            <FeedbackStatusIcon status={item.status} />
          </Flex>
          <FeedbackAttribution item={item} />
        </Flex>
        <Flex align="center" minWidth={0} minHeight="1lh">
          {item.sourceType === 'github-pr-comment' ? (
            <ExternalLink href={item.commentUrl}>{item.text}</ExternalLink>
          ) : (
            <FeedbackProse muted={isQueued}>
              <p>{item.text}</p>
            </FeedbackProse>
          )}
        </Flex>
      </Flex>
      {isQueued ? (
        <Flex flex="0 0 auto" align="center" height="1lh">
          <Text variant="muted" size="sm" wrap="nowrap">
            {t('Queued')}
          </Text>
        </Flex>
      ) : (
        item.timestamp && (
          <Flex flex="0 0 auto" align="center" height="1lh">
            <Text variant="muted" size="sm" wrap="nowrap">
              <TimeSince date={item.timestamp} />
            </Text>
          </Flex>
        )
      )}
    </Flex>
  );
}
