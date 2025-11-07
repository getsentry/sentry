import TextareaField from 'sentry/components/forms/fields/textareaField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';

export function DescribeSection() {
  return (
    <Container>
      <Section
        title={t('Description')}
        description={t('Additional context about this monitor for other team members.')}
      >
        <TextareaField
          name="description"
          stacked
          inline={false}
          aria-label={t('description')}
          placeholder={t(
            'Example monitor description\n\nTo debug follow these steps:\n1. \u2026\n2. \u2026\n3. \u2026'
          )}
          rows={6}
        />
      </Section>
    </Container>
  );
}
