import {Fragment, useMemo} from 'react';
import {IconList} from '@sentry/icons/list';
import {IconRefresh} from '@sentry/icons/refresh';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  getAutofixArtifactFromSection,
  isOutOfCreditsSection,
  isSolutionArtifact,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {OUT_OF_CREDITS_STEP_MESSAGE} from 'sentry/components/seer/outOfCredits/messages';
import {useOutOfCreditsRetry} from 'sentry/components/seer/outOfCredits/useOutOfCreditsRetry';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

import {ArtifactCard} from './artifactCard';
import {ArtifactDetails} from './artifactDetails';
import {ArtifactLoadingDetails, ArtifactPartialDetails} from './artifactLoadingDetails';
import {AutofixResetPrompt} from './autofixResetPrompt';
import {OutOfCreditsStatus} from './outOfCreditsStatus';
import {useResetAutofixStep} from './useResetAutofixStep';
import {useRethinkInChat} from './useRethinkInChat';
import {artifactToMarkdown} from './utils';

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

  const isOutOfCredits = isOutOfCreditsSection(section);
  const outOfCreditsRetry = useOutOfCreditsRetry('autofix_solution', {
    enabled: isOutOfCredits,
  });

  const {canReset, shouldShowReset, setShouldShowReset, handleReset} =
    useResetAutofixStep({
      autofix,
      // A step that stopped for credits fails the same way until the
      // organization can afford it again.
      canReset: outOfCreditsRetry.disabled ? false : undefined,
      section,
      step: 'solution',
    });

  const rethinkPrompt = t('How can this plan be improved?');
  const resetPrompt = shouldShowReset ? (
    <AutofixResetPrompt
      onClosePrompt={() => setShouldShowReset(false)}
      onReset={handleReset}
      placeholder={t('Give seer additional context to improve this plan.')}
      prompt={rethinkPrompt}
    />
  ) : null;
  const rethinkInChat = useRethinkInChat({
    prompt: rethinkPrompt,
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
      resetTooltip={outOfCreditsRetry.tooltip}
    >
      {section.status === 'processing' ? (
        <ArtifactLoadingDetails
          blocks={section.blocks}
          loadingMessage={t('Formulating a plan\u2026')}
        />
      ) : artifact?.data ? (
        <Fragment>
          {resetPrompt}
          <ArtifactDetails>
            <SeerMarkdown raw={artifact.data.one_line_summary} />
          </ArtifactDetails>
          {artifact.data.steps ? (
            <ArtifactDetails>
              <Text bold>{t('Steps to Resolve')}</Text>
              <Container as="ol" margin="0">
                {artifact.data.steps.map((step, index) => (
                  <li key={index}>
                    <Stack>
                      <SeerMarkdown raw={step.title} />
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
      ) : isOutOfCredits ? (
        <Fragment>
          <ArtifactPartialDetails blocks={section.blocks} />
          <OutOfCreditsStatus message={OUT_OF_CREDITS_STEP_MESSAGE.solution}>
            {resetPrompt ?? (
              <Flex>
                <Button
                  variant="primary"
                  icon={<IconRefresh />}
                  disabled={!canReset}
                  tooltipProps={{title: outOfCreditsRetry.tooltip}}
                  onClick={() => handleReset()}
                >
                  {t('Re-run')}
                </Button>
              </Flex>
            )}
          </OutOfCreditsStatus>
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
