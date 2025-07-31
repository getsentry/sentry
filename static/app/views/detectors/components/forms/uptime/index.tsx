import styled from '@emotion/styled';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {AssigneeField} from 'sentry/views/detectors/components/forms/assigneeField';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';
import {UptimeDetectorFormDetectSection} from 'sentry/views/detectors/components/forms/uptime/detect';
import {
  UPTIME_DETECTOR_FORM_FIELDS,
  uptimeFormDataToEndpointPayload,
  uptimeSavedDetectorToFormData,
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
      <AutomateSection />
    </FormStack>
  );
}

export function NewUptimeDetectorForm() {
  return (
    <NewDetectorLayout
      detectorType="uptime_domain_failure"
      formDataToEndpointPayload={uptimeFormDataToEndpointPayload}
      initialFormData={{}}
    >
      <UptimeDetectorForm />
    </NewDetectorLayout>
  );
}

export function EditExistingUptimeDetectorForm({detector}: {detector: UptimeDetector}) {
  return (
    <EditDetectorLayout
      detector={detector}
      formDataToEndpointPayload={uptimeFormDataToEndpointPayload}
      savedDetectorToFormData={uptimeSavedDetectorToFormData}
    >
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
