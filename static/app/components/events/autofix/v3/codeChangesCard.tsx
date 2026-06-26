import {Fragment, useMemo} from 'react';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

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
import {PrIterationFeedbackForm} from 'sentry/components/events/autofix/v3/prIterationFeedbackForm';
import {useResetAutofixStep} from 'sentry/components/events/autofix/v3/useResetAutofixStep';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {TimeSince} from 'sentry/components/timeSince';
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

interface BaseFeedback {
  iterationIndex: number;
  text: string;
  timestamp?: string;
}

interface UserUiFeedback extends BaseFeedback {
  sourceType: 'user-ui';
  user?: User | null;
}

interface GithubPrCommentFeedback extends BaseFeedback {
  sourceType: 'github-pr-comment';
  commentUrl?: string;
  githubUsername?: string;
}

type IterationFeedback = UserUiFeedback | GithubPrCommentFeedback;

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

/**
 * Feedback is stored as a JSON object (`{text, source, timestamp}`), where
 * `source` identifies who submitted it: `{type: 'user-ui', user_id, user}` from
 * the Sentry UI (the backend resolves `user_id` into a serialized `user`) or
 * `{type: 'github-pr-comment', comment}` from an `@sentry` PR comment, where
 * `comment` is the raw GitHub comment payload (we read `comment.user.login` for
 * attribution and `comment.html_url` to link back to it).
 *
 * We mux on `source.type` so each variant produces its own discriminated
 * `IterationFeedback`, which `FeedbackItem` then renders per-type. Source types
 * we don't recognize return `null` so a backend change can roll out ahead of the
 * frontend without rendering anything unexpected.
 */
function parseFeedback(
  raw: string
): DistributiveOmit<IterationFeedback, 'iterationIndex'> | null {
  const parsed: {
    text: string;
    source?: {
      type: string;
      comment?: {html_url?: string; user?: {login: string}};
      user?: User;
    };
    timestamp?: string;
  } = JSON.parse(raw);
  const base = {text: parsed.text, timestamp: parsed.timestamp};
  switch (parsed.source?.type) {
    case 'user-ui':
      return {...base, sourceType: 'user-ui', user: parsed.source?.user};
    case 'github-pr-comment':
      return {
        ...base,
        sourceType: 'github-pr-comment',
        githubUsername: parsed.source?.comment?.user?.login,
        commentUrl: parsed.source?.comment?.html_url,
      };
    default:
      return null;
  }
}

/**
 * When the coding step finishes without producing any patches, the agent often
 * still leaves a final assistant message explaining why — e.g. the real fix is a
 * database migration / infra change, or the relevant files aren't in the
 * connected repo. Surface that explanation instead of a generic "this one is on
 * us" message so the user knows a plain re-run won't help.
 */
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

  // PR iterations are folded into this section's blocks. Surface the feedback
  // that drove each one — the cumulative diff is already merged into the
  // section's code-change artifact by getOrderedAutofixSections. Gated behind
  // the PR iteration feature; when it's off we render the card as if no
  // iterations exist.
  const feedback = useMemo<IterationFeedback[]>(
    () =>
      hasPrIterationFeature
        ? section.blocks.filter(isPrIterationBlock).flatMap(block => {
            const metadata = block.message.metadata;
            const value = metadata?.feedback;
            const iterationIndex = metadata?.iteration_index;
            if (!value || iterationIndex === undefined) {
              return [];
            }
            const parsed = parseFeedback(value);
            if (!parsed) {
              return [];
            }
            return [{...parsed, iterationIndex: Number(iterationIndex)}];
          })
        : [],
    [section.blocks, hasPrIterationFeature]
  );

  const latestIterationIndex = useMemo(
    () =>
      feedback.reduce<number | null>(
        (max, item) =>
          max === null ? item.iterationIndex : Math.max(max, item.iterationIndex),
        null
      ),
    [feedback]
  );

  const isIterating =
    hasPrIterationFeature &&
    section.status === 'processing' &&
    section.blocks.some(isPrIterationBlock);

  // While processing, only replay the assistant output from the current
  // in-progress step. Steps (the original coding step plus each PR iteration)
  // are folded into this section's blocks; the first block of each step carries
  // a `step` marker and the rest inherit it, so slice from the latest marker to
  // avoid replaying earlier, already-finished steps.
  const loadingBlocks = useMemo(() => {
    const currentStepStart = section.blocks.findLastIndex(block =>
      defined(block.message.metadata?.step)
    );
    return currentStepStart === -1
      ? section.blocks
      : section.blocks.slice(currentStepStart);
  }, [section.blocks]);

  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isCodeChangesArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);

  const {copy} = useCopyToClipboard();
  const markdown = useMemo(
    () => (artifact ? artifactToMarkdown(artifact) : null),
    [artifact]
  );

  const {canReset, shouldShowReset, setShouldShowReset, handleReset} =
    useResetAutofixStep({
      autofix,
      section,
      step: 'code_changes',
    });

  const prIterationEnabled = hasPrIterationFeature;
  const hasPRs = Object.keys(autofix.runState?.repo_pr_states ?? {}).length > 0;

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

  return (
    <ArtifactCard
      icon={<IconCode />}
      title={
        latestIterationIndex === null ? (
          t('Code Changes')
        ) : (
          <Flex gap="md" align="center">
            {t('Code Changes')}
            {/* `iteration_index` is zero-based; display a one-based version number. */}
            <Tag variant="muted">{t('v%s - Latest', latestIterationIndex + 1)}</Tag>
          </Flex>
        )
      }
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
          {feedback.map(item => (
            <FeedbackItem key={item.iterationIndex} item={item} />
          ))}
        </ArtifactDetails>
      )}
      {isProcessing ? (
        <ArtifactLoadingDetails
          blocks={loadingBlocks}
          loadingMessage={
            isIterating ? t('Iterating on PR…') : t('Implementing changes…')
          }
        />
      ) : artifact && patchesByRepo.size ? (
        <Fragment>
          {shouldShowReset &&
            (hasPRs && prIterationEnabled ? (
              <PrIterationFeedbackForm
                autofix={autofix}
                groupId={groupId}
                runId={autofix.runState?.run_id}
                referrer="code_changes_card_reset"
                onClose={() => setShouldShowReset(false)}
              />
            ) : (
              <AutofixResetPrompt
                onClosePrompt={() => setShouldShowReset(false)}
                onReset={handleReset}
                placeholder={t(
                  'Give seer additional context to improve this code change.'
                )}
                prompt={t('How can this code change be improved?')}
              />
            ))}
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
      ) : explanation ? (
        <ArtifactDetails gap="lg">
          <Flex direction="column" gap="md">
            <Text bold>
              {t("Seer proposed a fix but couldn't apply it automatically")}
            </Text>
            <Markdown raw={explanation} />
          </Flex>

          {shouldShowReset ? (
            hasPRs && prIterationEnabled ? (
              <PrIterationFeedbackForm
                autofix={autofix}
                groupId={groupId}
                runId={autofix.runState?.run_id}
                referrer="code_changes_card_reset"
                onClose={() => setShouldShowReset(false)}
              />
            ) : (
              <AutofixResetPrompt
                onClosePrompt={() => setShouldShowReset(false)}
                onReset={handleReset}
                placeholder={t(
                  'Add context that could unblock the change, e.g. the repo or files to edit.'
                )}
                prompt={t('What additional context should Seer use?')}
              />
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
      ) : (
        <ArtifactDetails>
          <Text>
            {t(
              'Seer failed to generate a code change. This one is on us. Try running it again.'
            )}
          </Text>
          <div>
            <Button
              variant="primary"
              icon={<IconRefresh />}
              onClick={() => handleReset()}
            >
              {t('Re-run')}
            </Button>
          </div>
        </ArtifactDetails>
      )}
    </ArtifactCard>
  );
}

function FeedbackAttribution({item}: {item: IterationFeedback}) {
  switch (item.sourceType) {
    case 'github-pr-comment':
      return (
        <Tooltip title={t('From a GitHub PR comment')}>
          <Flex gap="xs" align="center" flex="0 0 auto">
            <IconGithub size="md" />
            {item.githubUsername &&
              (item.commentUrl ? (
                <ExternalLink href={item.commentUrl}>
                  <Text wrap="nowrap">{item.githubUsername}</Text>
                </ExternalLink>
              ) : (
                <Text underline wrap="nowrap">
                  {item.githubUsername}
                </Text>
              ))}
          </Flex>
        </Tooltip>
      );
    case 'user-ui':
      return item.user ? <UserAvatar size={16} user={item.user} hasTooltip /> : null;
    default:
      return null;
  }
}

function FeedbackItem({item}: {item: IterationFeedback}) {
  return (
    <Flex gap="md" align="start" justify="between">
      <Flex gap="md" align="center" flex="1" minWidth={0}>
        <FeedbackAttribution item={item} />
        <Text wordBreak="break-word">{t('"%s"', item.text)}</Text>
      </Flex>
      {item.timestamp && (
        <Flex flex="0 0 auto" align="center">
          <Text variant="muted" size="sm" wrap="nowrap">
            <TimeSince date={item.timestamp} />
          </Text>
        </Flex>
      )}
    </Flex>
  );
}
