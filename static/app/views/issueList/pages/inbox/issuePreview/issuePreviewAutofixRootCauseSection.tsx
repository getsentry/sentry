import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {
  type AutofixSection,
  getAutofixArtifactFromSection,
  isRootCauseArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {AutofixEvidence} from 'sentry/components/events/autofix/v3/autofixEvidence';
import {useAutofixSectionEvidence} from 'sentry/components/events/autofix/v3/useAutofixSectionEvidence';
import {t} from 'sentry/locale';

import {IssuePreviewSection} from './issuePreviewSection';
import {WorkingIndicator} from './workingIndicator';

export function IssuePreviewAutofixRootCauseSection({
  groupId,
  section,
}: {
  groupId: string;
  section: AutofixSection;
}) {
  const artifact = getAutofixArtifactFromSection(section);
  const rootCause = isRootCauseArtifact(artifact) && artifact.data ? artifact.data : null;
  const evidence = useAutofixSectionEvidence({section});
  const hasDetails = Boolean(
    rootCause &&
    (rootCause.five_whys.length ||
      rootCause.reproduction_steps?.length ||
      evidence.length)
  );

  return (
    <IssuePreviewSection
      section={section}
      summary={
        section.status === 'processing' ? (
          <WorkingIndicator blocks={section.blocks}>
            {t('Generating root cause...')}
          </WorkingIndicator>
        ) : rootCause ? (
          <Markdown raw={rootCause.one_line_description} />
        ) : (
          <Text variant="muted">{t('No root cause was identified.')}</Text>
        )
      }
    >
      {hasDetails && (
        <Stack gap="lg">
          {rootCause?.five_whys.length ? (
            <Stack gap="md">
              <Text bold>{t('Why did this happen?')}</Text>
              <Stack as="ul" gap="sm" paddingLeft="xl" margin="0">
                {rootCause.five_whys.map((why, index) => (
                  <Container as="li" key={index}>
                    <Markdown raw={why} />
                  </Container>
                ))}
              </Stack>
            </Stack>
          ) : null}
          {rootCause?.reproduction_steps?.length ? (
            <Stack gap="md">
              <Text bold>{t('Reproduction Steps')}</Text>
              <Stack as="ol" gap="sm" paddingLeft="xl" margin="0">
                {rootCause.reproduction_steps.map((step, index) => (
                  <Container as="li" key={index}>
                    <Markdown raw={step} />
                  </Container>
                ))}
              </Stack>
            </Stack>
          ) : null}
          {rootCause && evidence.length > 0 ? (
            <Stack gap="md">
              <Text bold>{t('Evidence')}</Text>
              <Flex gap="md" wrap="wrap">
                {evidence.map(item => (
                  <AutofixEvidence
                    key={item.toolCall.id}
                    evidenceButtonProps={item.evidenceButtonProps}
                    groupId={groupId}
                    toolCall={item.toolCall}
                  />
                ))}
              </Flex>
            </Stack>
          ) : null}
        </Stack>
      )}
    </IssuePreviewSection>
  );
}
