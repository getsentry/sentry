import styled from '@emotion/styled';

import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {AssignSection} from 'sentry/views/detectors/components/forms/common/assignSection';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';
import {UptimeDetectorFormDetectSection} from 'sentry/views/detectors/components/forms/uptime/detect';
import {
  uptimeFormDataToEndpointPayload,
  uptimeSavedDetectorToFormData,
} from 'sentry/views/detectors/components/forms/uptime/fields';
import {UptimeRegionWarning} from 'sentry/views/detectors/components/forms/uptime/regionWarning';
import {UptimeDetectorResolveSection} from 'sentry/views/detectors/components/forms/uptime/resolve';

function UptimeDetectorForm() {
  return (
    <FormStack>
      <UptimeRegionWarning />
      <UptimeDetectorFormDetectSection />
      <UptimeDetectorResolveSection />
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
      initialFormData={{name: 'New Monitor'}}
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
  gap: ${p => p.theme.space['2xl']};
  max-width: ${p => p.theme.breakpoints.lg};
  padding-bottom: 160px;
`;
