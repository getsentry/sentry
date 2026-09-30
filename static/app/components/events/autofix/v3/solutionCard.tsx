import {Fragment, useMemo} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {
  getAutofixArtifactFromSection,
  isSolutionArtifact,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ArtifactCard} from 'sentry/components/events/autofix/v3/artifactCard';
import {ArtifactDetails} from 'sentry/components/events/autofix/v3/artifactDetails';
import {ArtifactLoadingDetails} from 'sentry/components/events/autofix/v3/artifactLoadingDetails';
import {AutofixResetPrompt} from 'sentry/components/events/autofix/v3/autofixResetPrompt';
import {useResetAutofixStep} from 'sentry/components/events/autofix/v3/useResetAutofixStep';
import {useRethinkInChat} from 'sentry/components/events/autofix/v3/useRethinkInChat';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {IconList} from 'sentry/icons/iconList';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

interface SolutionCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  section: AutofixSection;
}

export function SolutionCard({autofix, section}: SolutionCardProps) {
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isSolutionArtifact(sectionArtifact) ? sectionArtifact : null;
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
      step: 'solution',
    });

  const rethinkPrompt = t('How can this plan be improved?');
  const rethinkInChat = useRethinkInChat({
    prompt: rethinkPrompt,
    runId: getAutofixRunId(autofix.runState),
    step: 'solution',
  });

  return (
    <ArtifactCard
      icon={<IconList />}
      title={t('Plan')}
      onCopy={
        markdown
          ? () => copy(markdown, {successMessage: t('Copied to clipboard.')})
          : undefined
      }
      allowReset
      onReset={canReset ? (rethinkInChat ?? (() => setShouldShowReset(true))) : undefined}
      resetInChat={defined(rethinkInChat)}
    >
      {section.status === 'processing' ? (
        <ArtifactLoadingDetails
          blocks={section.blocks}
          loadingMessage={t('Formulating a plan\u2026')}
        />
      ) : artifact?.data ? (
        <Fragment>
          {shouldShowReset && (
            <AutofixResetPrompt
              onClosePrompt={() => setShouldShowReset(false)}
              onReset={handleReset}
              placeholder={t('Give seer additional context to improve this plan.')}
              prompt={rethinkPrompt}
            />
          )}
          <ArtifactDetails>
            <Markdown raw={artifact.data.one_line_summary} />
          </ArtifactDetails>
          {artifact.data.steps ? (
            <ArtifactDetails>
              <Text bold>{t('Steps to Resolve')}</Text>
              <Container as="ol" margin="0">
                {artifact.data.steps.map((step, index) => (
                  <li key={index}>
                    <Stack>
                      <Markdown raw={step.title} />
                      <Text size="sm" variant="muted">
                        {step.description}
                      </Text>
                    </Stack>
                  </li>
                ))}
              </Container>
            </ArtifactDetails>
          ) : null}
        </Fragment>
      ) : (
        <ArtifactDetails>
          <Text>
            {t(
              'Seer failed to generate a plan. This one is on us. Try running it again.'
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
