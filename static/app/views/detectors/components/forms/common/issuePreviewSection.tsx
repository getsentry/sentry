import {Container} from 'sentry/components/workflowEngine/ui/container';
import {Section} from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';

export function IssuePreviewSection({children}: {children: React.ReactNode}) {
  return (
    <Container data-test-id="issue-preview-section">
      <Section
        title={t('Preview')}
        description={t(
          'Given your configurations, this is a sample of the kind of issue you can expect this Monitor to produce.'
        )}
      >
        {children}
      </Section>
    </Container>
  );
}
