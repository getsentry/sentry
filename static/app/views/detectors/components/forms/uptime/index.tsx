import styled from '@emotion/styled';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {AssigneeField} from 'sentry/views/detectors/components/forms/assigneeField';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';
import {UptimeDetectorFormDetectSection} from 'sentry/views/detectors/components/forms/uptime/detect';
import {
  UPTIME_DETECTOR_FORM_FIELDS,
  useUptimeDetectorFormField,
} from 'sentry/views/detectors/components/forms/uptime/fields';

function AssignSection() {
  const projectId = useUptimeDetectorFormField(UPTIME_DETECTOR_FORM_FIELDS.projectId);
  return (
    <Container>
      <Section title={t('Assign')}>
        <AssigneeField projectId={projectId} />
      </Section>
    </Container>
  );
}

function UptimeDetectorForm() {
  return (
    <FormStack>
      <UptimeDetectorFormDetectSection />
      <AssignSection />
    </FormStack>
  );
}

export function NewUptimeDetectorForm() {
  return (
    <NewDetectorLayout detectorType="uptime_domain_failure">
      <UptimeDetectorForm />
    </NewDetectorLayout>
  );
}

export function EditExistingUptimeDetectorForm({detector}: {detector: Detector}) {
  return (
    <EditDetectorLayout detector={detector} detectorType="uptime_domain_failure">
      <UptimeDetectorForm />
    </EditDetectorLayout>
  );
}

const FormStack = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  max-width: ${p => p.theme.breakpoints.xl};
`;
