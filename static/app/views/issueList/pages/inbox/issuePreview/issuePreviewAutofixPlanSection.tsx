import {Container, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {
  type AutofixSection,
  getAutofixArtifactFromSection,
  isSolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';

import {IssuePreviewSection} from './issuePreviewSection';
import {WorkingIndicator} from './workingIndicator';

export function IssuePreviewAutofixPlanSection({section}: {section: AutofixSection}) {
  const artifact = getAutofixArtifactFromSection(section);
  const plan = isSolutionArtifact(artifact) && artifact.data ? artifact.data : null;

  return (
    <IssuePreviewSection
      section={section}
      summary={
        section.status === 'processing' ? (
          <WorkingIndicator blocks={section.blocks}>
            {t('Generating implementation plan...')}
          </WorkingIndicator>
        ) : plan ? (
          <Markdown raw={plan.one_line_summary} />
        ) : (
          <Text variant="muted">{t('No implementation plan was generated.')}</Text>
        )
      }
    >
      {plan?.steps.length ? (
        <Stack gap="md">
          <Text bold>{t('Steps to Resolve')}</Text>
          <Stack as="ol" gap="md" paddingLeft="xl" margin="0">
            {plan.steps.map((step, index) => (
              <Container as="li" key={index}>
                <Stack gap="xs">
                  <Markdown raw={step.title} />
                  <Markdown raw={step.description} />
                </Stack>
              </Container>
            ))}
          </Stack>
        </Stack>
      ) : null}
    </IssuePreviewSection>
  );
}
