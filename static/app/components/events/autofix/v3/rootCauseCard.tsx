import {Fragment, useMemo} from 'react';
import {IconBug} from '@sentry/icons/bug';
import {IconRefresh} from '@sentry/icons/refresh';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  getAutofixArtifactFromSection,
  getSingleRunStop,
  isRootCauseArtifact,
  isSingleRunAutofix,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

import {ArtifactCard} from './artifactCard';
import {ArtifactDetails} from './artifactDetails';
import {ArtifactLoadingDetails} from './artifactLoadingDetails';
import {AutofixEvidence} from './autofixEvidence';
import {AutofixResetPrompt} from './autofixResetPrompt';
import {useAutofixSectionEvidence} from './useAutofixSectionEvidence';
import {useResetAutofixStep} from './useResetAutofixStep';
import {useRethinkInChat} from './useRethinkInChat';
import {useRerunSingleRun} from './useToggleSingleRunChat';
import {artifactToMarkdown} from './utils';

interface RootCauseCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  groupId: string;
  section: AutofixSection;
}

export function RootCauseCard({autofix, groupId, section}: RootCauseCardProps) {
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isRootCauseArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);
  const stop = getSingleRunStop(section);
  const stopDetails = stop ? (
    <ArtifactDetails>
      <Text bold>{t('Why Seer stopped')}</Text>
      <SeerMarkdown raw={stop.reason} />
      <Text bold>{t('Suggestion')}</Text>
      <SeerMarkdown raw={stop.suggestion} />
    </ArtifactDetails>
  ) : null;

  const {copy} = useCopyToClipboard();
  const isSingleRun = isSingleRunAutofix(autofix.runState);
  const singleRunRerun = useRerunSingleRun(autofix, {
    enabled: isSingleRun && section.status !== 'processing' && !artifact?.data && !stop,
  });
  const markdown = useMemo(
    () => (artifact ? artifactToMarkdown(artifact) : null),
    [artifact]
  );

  const {canReset, shouldShowReset, setShouldShowReset, handleReset} =
    useResetAutofixStep({
      autofix,
      section,
      step: 'root_cause',
    });

  const rethinkPrompt = t('How can this root cause be improved?');
  const rethinkInChat = useRethinkInChat({
    prompt: rethinkPrompt,
    step: 'root_cause',
  });

  const evidence = useAutofixSectionEvidence({section});

  return (
    <ArtifactCard
      icon={<IconBug />}
      title={t('Root Cause')}
      onCopy={
        markdown
          ? () => copy(markdown, {successMessage: t('Copied to clipboard.')})
          : undefined
      }
      // Single runs reject step restarts; people redo the root cause by replying in the chat.
      allowReset={!isSingleRunAutofix(autofix.runState)}
      onReset={canReset ? (rethinkInChat ?? (() => setShouldShowReset(true))) : undefined}
      resetInChat={defined(rethinkInChat)}
    >
      {section.status === 'processing' ? (
        <ArtifactLoadingDetails
          blocks={section.blocks}
          loadingMessage={t('Finding the root cause\u2026')}
        />
      ) : artifact?.data ? (
        <Fragment>
          {shouldShowReset && (
            <AutofixResetPrompt
              onClosePrompt={() => setShouldShowReset(false)}
              onReset={handleReset}
              placeholder={t('Give seer additional context to improve this root cause.')}
              prompt={rethinkPrompt}
            />
          )}
          <ArtifactDetails>
            <SeerMarkdown raw={artifact.data.one_line_description} />
            {artifact.data.cause ? <SeerMarkdown raw={artifact.data.cause} /> : null}
          </ArtifactDetails>
          {artifact.data.five_whys?.length ? (
            <Fragment>
              <ArtifactDetails>
                <Text bold>{t('Why did this happen?')}</Text>
                <Container as="ul" margin="0">
                  {artifact.data.five_whys.map((why, index) => (
                    <li key={index}>
                      <SeerMarkdown raw={why} />
                    </li>
                  ))}
                </Container>
              </ArtifactDetails>
              {artifact.data.reproduction_steps?.length ? (
                <ArtifactDetails>
                  <Text bold>{t('Reproduction Steps')}</Text>
                  <Container as="ol" margin="0">
                    {artifact.data?.reproduction_steps.map((step, index) => (
                      <li key={index}>
                        <SeerMarkdown raw={step} />
                      </li>
                    ))}
                  </Container>
                </ArtifactDetails>
              ) : null}
            </Fragment>
          ) : null}
          {evidence.length > 0 && (
            <ArtifactDetails>
              <Text bold>{t('Evidence')}</Text>
              <Flex gap="md" wrap="wrap">
                {evidence.map(e => (
                  <AutofixEvidence
                    key={e.toolCall.id}
                    evidenceButtonProps={e.evidenceButtonProps}
                    groupId={groupId}
                    toolCall={e.toolCall}
                  />
                ))}
              </Flex>
            </ArtifactDetails>
          )}
          {stopDetails}
        </Fragment>
      ) : stopDetails ? (
        stopDetails
      ) : (
        <ArtifactDetails>
          <Text>
            {t(
              'Seer failed to generate a root cause. This one is on us. Try running it again.'
            )}
          </Text>
          <div>
            <Button
              variant="primary"
              icon={<IconRefresh />}
              disabled={isSingleRun && singleRunRerun.disabled}
              onClick={isSingleRun ? singleRunRerun.rerun : () => handleReset()}
            >
              {t('Re-run')}
            </Button>
          </div>
        </ArtifactDetails>
      )}
    </ArtifactCard>
  );
}
