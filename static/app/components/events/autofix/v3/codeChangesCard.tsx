import {Fragment, useMemo} from 'react';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
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
import {useResetAutofixStep} from 'sentry/components/events/autofix/v3/useResetAutofixStep';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCode} from 'sentry/icons/iconCode';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t, tn} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

interface CodeChangesCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  section: AutofixSection;
}

interface IterationFeedback {
  iterationIndex: number;
  text: string;
  timestamp?: string;
  user?: User | null;
}

/**
 * Feedback is stored as a JSON object (`{text, source, timestamp}`), where
 * `source` identifies who submitted it (e.g. `{type: 'user-ui', user_id, user}`).
 * The backend resolves `user_id` into a serialized `user` so we can render
 * attribution directly without a per-item fetch.
 */
function parseFeedback(raw: string): Omit<IterationFeedback, 'iterationIndex'> {
  const parsed = JSON.parse(raw);
  return {
    text: parsed.text,
    user: parsed.source?.user,
    timestamp: parsed.timestamp,
  };
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

export function CodeChangesCard({autofix, section}: CodeChangesCardProps) {
  // PR iterations are folded into this section's blocks. Surface the feedback
  // that drove each one — the cumulative diff is already merged into the
  // section's code-change artifact by getOrderedAutofixSections.
  const feedback = useMemo<IterationFeedback[]>(
    () =>
      section.blocks.filter(isPrIterationBlock).flatMap(block => {
        const metadata = block.message.metadata;
        const value = metadata?.feedback;
        const iterationIndex = metadata?.iteration_index;
        if (!value || iterationIndex === undefined) {
          return [];
        }
        return [{...parseFeedback(value), iterationIndex: Number(iterationIndex)}];
      }),
    [section.blocks]
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
    section.status === 'processing' && section.blocks.some(isPrIterationBlock);

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
          blocks={section.blocks}
          loadingMessage={
            isIterating ? t('Iterating on PR…') : t('Implementing changes…')
          }
        />
      ) : artifact && patchesByRepo.size ? (
        <Fragment>
          {shouldShowReset && (
            <AutofixResetPrompt
              onClosePrompt={() => setShouldShowReset(false)}
              onReset={handleReset}
              placeholder={t('Give seer additional context to improve this code change.')}
              prompt={t('How can this code change be improved?')}
            />
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
      ) : explanation ? (
        <ArtifactDetails gap="lg">
          <Flex direction="column" gap="md">
            <Text bold>
              {t("Seer proposed a fix but couldn't apply it automatically")}
            </Text>
            <Markdown raw={explanation} />
          </Flex>

          {shouldShowReset ? (
            <AutofixResetPrompt
              onClosePrompt={() => setShouldShowReset(false)}
              onReset={handleReset}
              placeholder={t(
                'Add context that could unblock the change, e.g. the repo or files to edit.'
              )}
              prompt={t('What additional context should Seer use?')}
            />
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

function FeedbackItem({item}: {item: IterationFeedback}) {
  return (
    <Flex gap="md" align="start" justify="between">
      <Flex gap="md" align="center" flex="1" minWidth={0}>
        {item.user && <UserAvatar size={20} user={item.user} />}
        <Text wordBreak="break-word">{t('"%s"', item.text)}</Text>
      </Flex>
      {item.timestamp && (
        <Flex flex="0 0 auto">
          <Text variant="muted" size="sm" wrap="nowrap">
            <TimeSince date={item.timestamp} />
          </Text>
        </Flex>
      )}
    </Flex>
  );
}
