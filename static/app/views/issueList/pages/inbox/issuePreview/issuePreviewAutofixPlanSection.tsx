import {Fragment} from 'react';

import {Container, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {
  type AutofixSection,
  getAutofixArtifactFromSection,
  isSolutionArtifact,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';

import {CopySectionMarkdown} from './copySectionMarkdown';
import {IssuePreviewSection} from './issuePreviewSection';
import {RetryableAutofixSection} from './retryableAutofixSection';
import {WorkingIndicator} from './workingIndicator';

export function IssuePreviewAutofixPlanSection({
  autofix,
  defaultExpanded,
  section,
}: {
  autofix: ReturnType<typeof useExplorerAutofix>;
  defaultExpanded: boolean;
  section: AutofixSection;
}) {
  const artifact = getAutofixArtifactFromSection(section);
  const plan = isSolutionArtifact(artifact) && artifact.data ? artifact.data : null;

  return (
    <RetryableAutofixSection autofix={autofix} section={section} step="solution">
      <IssuePreviewSection
        aria-label={t('Implementation Plan')}
        defaultExpanded={defaultExpanded}
      >
        <IssuePreviewSection.Title
          trailingItems={
            <Fragment>
              <RetryableAutofixSection.Button />
              <CopySectionMarkdown section={section} />
            </Fragment>
          }
        >
          {t('Implementation Plan')}
        </IssuePreviewSection.Title>
        <IssuePreviewSection.Summary>
          <RetryableAutofixSection.Prompt
            placeholder={t('Give Seer additional context to improve this plan.')}
            prompt={t('How can this plan be improved?')}
          />
          {section.status === 'processing' ? (
            <WorkingIndicator blocks={section.blocks}>
              {t('Generating implementation plan...')}
            </WorkingIndicator>
          ) : plan ? (
            <Markdown raw={plan.one_line_summary} />
          ) : (
            <Text variant="muted">{t('No implementation plan was generated.')}</Text>
          )}
        </IssuePreviewSection.Summary>
        <IssuePreviewSection.Content>
          {plan?.steps.length ? (
            <Stack gap="md">
              <Text bold>{t('Steps to Resolve')}</Text>
              <Stack as="ol" gap="md" paddingLeft="xl">
                {plan.steps.map((step, index) => (
                  <Container as="li" key={index}>
                    <Stack gap="xs">
                      <Markdown raw={step.title} />
                      <Text size="sm" variant="muted">
                        {step.description}
                      </Text>
                    </Stack>
                  </Container>
                ))}
              </Stack>
            </Stack>
          ) : null}
        </IssuePreviewSection.Content>
      </IssuePreviewSection>
    </RetryableAutofixSection>
  );
}
