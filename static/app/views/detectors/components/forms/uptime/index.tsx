import styled from '@emotion/styled';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AssigneeField} from 'sentry/views/detectors/components/forms/assigneeField';
import {UptimeDetectorFormDetectSection} from 'sentry/views/detectors/components/forms/uptime/detect';

export function UptimeDetectorForm() {
  return (
    <FormStack>
      <UptimeDetectorFormDetectSection />
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
