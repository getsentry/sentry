import {Fragment, useMemo} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {
  collectPatches,
  getAutofixArtifactFromSection,
  isCodeChangesArtifact,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ArtifactCard} from 'sentry/components/events/autofix/v3/artifactCard';
import {ArtifactDetails} from 'sentry/components/events/autofix/v3/artifactDetails';
import {ArtifactLoadingDetails} from 'sentry/components/events/autofix/v3/artifactLoadingDetails';
import {AutofixResetPrompt} from 'sentry/components/events/autofix/v3/autofixResetPrompt';
import {useResetAutofixStep} from 'sentry/components/events/autofix/v3/useResetAutofixStep';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {IconCode} from 'sentry/icons/iconCode';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t, tn} from 'sentry/locale';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

interface CodeChangesCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  section: AutofixSection;
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

  return (
    <ArtifactCard
      icon={<IconCode />}
      title={t('Code Changes')}
      onCopy={
        markdown
          ? () => copy(markdown, {successMessage: t('Copied to clipboard.')})
          : undefined
      }
      allowReset
      onReset={canReset ? () => setShouldShowReset(true) : undefined}
    >
      {section.status === 'processing' ? (
        <ArtifactLoadingDetails
          blocks={section.blocks}
          loadingMessage={t('Implementing changes\u2026')}
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
        <ArtifactDetails>
          {shouldShowReset ? (
            <AutofixResetPrompt
              onClosePrompt={() => setShouldShowReset(false)}
              onReset={handleReset}
              placeholder={t(
                'Add context that could unblock the change, e.g. the repo or files to edit.'
              )}
              prompt={t('What additional context should Seer use?')}
            />
          ) : null}
          <Text bold>{t("Seer proposed a fix but couldn't apply it automatically")}</Text>
          <Markdown raw={explanation} />
          {shouldShowReset ? null : (
            <div>
              <Button
                variant="primary"
                icon={<IconRefresh />}
                disabled={!canReset}
                onClick={() => setShouldShowReset(true)}
              >
                {t('Add context & retry')}
              </Button>
            </div>
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
