import {Fragment, useMemo} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  getAutofixArtifactFromSection,
  isRootCauseArtifact,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ArtifactCard} from 'sentry/components/events/autofix/v3/artifactCard';
import {ArtifactDetails} from 'sentry/components/events/autofix/v3/artifactDetails';
import {ArtifactLoadingDetails} from 'sentry/components/events/autofix/v3/artifactLoadingDetails';
import {AutofixEvidence} from 'sentry/components/events/autofix/v3/autofixEvidence';
import {StyledMarkedText} from 'sentry/components/events/autofix/v3/styled';
import {useAutofixSectionEvidence} from 'sentry/components/events/autofix/v3/useAutofixSectionEvidence';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {IconBug} from 'sentry/icons/iconBug';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

interface RootCauseCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  section: AutofixSection;
}

export function RootCauseCard({autofix, section}: RootCauseCardProps) {
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isRootCauseArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);

  const {copy} = useCopyToClipboard();
  const markdown = useMemo(
    () => (artifact ? artifactToMarkdown(artifact) : null),
    [artifact]
  );
  const {startStep} = autofix;

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
    >
      {section.status === 'processing' ? (
        <ArtifactLoadingDetails
          blocks={section.blocks}
          loadingMessage={t('Finding the root cause\u2026')}
        />
      ) : artifact?.data ? (
        <Fragment>
          <StyledMarkedText text={artifact.data.one_line_description} />
          {artifact.data.five_whys?.length ? (
            <Fragment>
              <ArtifactDetails>
                <Text bold>{t('Why did this happen?')}</Text>
                <Container as="ul" margin="0">
                  {artifact.data.five_whys.map((why, index) => (
                    <li key={index}>
                      <StyledMarkedText text={why} />
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
                        <StyledMarkedText text={step} />
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
                  />
                ))}
              </Flex>
            </ArtifactDetails>
          )}
        </Fragment>
      ) : (
        <ArtifactDetails>
          <Text>
            {t(
              'Seer failed to generate a root cause. This one is on us. Try running it again.'
            )}
          </Text>
          <div>
            <Button
              priority="primary"
              icon={<IconRefresh />}
              onClick={() => startStep('root_cause')}
            >
              {t('Re-run')}
            </Button>
          </div>
        </ArtifactDetails>
      )}
    </ArtifactCard>
  );
}
