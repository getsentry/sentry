import styled from '@emotion/styled';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AssigneeField} from 'sentry/views/detectors/components/forms/assigneeField';
import {CronDetectorFormDetectSection} from 'sentry/views/detectors/components/forms/cron/detect';

export function CronDetectorForm() {
  return (
    <FormStack>
      <CronDetectorFormDetectSection />
      <AssignSection />
    </FormStack>
  );
}

function AssignSection() {
  return (
    <Container>
      <Section title={t('Assign')}>
        {/* TODO: Add projectId from form context */}
        <AssigneeField projectId="" />
      </Section>
    </Container>
  );
}

const FormStack = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  max-width: ${p => p.theme.breakpoints.xl};
`;
