import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {AssignSection} from 'sentry/views/detectors/components/forms/common/assignSection';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';
import {UptimeDetectorFormDetectSection} from 'sentry/views/detectors/components/forms/uptime/detect';
import {
  UPTIME_DEFAULT_DOWNTIME_THRESHOLD,
  UPTIME_DEFAULT_RECOVERY_THRESHOLD,
  uptimeFormDataToEndpointPayload,
  uptimeSavedDetectorToFormData,
} from 'sentry/views/detectors/components/forms/uptime/fields';
import {UptimeRegionWarning} from 'sentry/views/detectors/components/forms/uptime/regionWarning';
import {UptimeDetectorFormRespondSection} from 'sentry/views/detectors/components/forms/uptime/respond';

function UptimeDetectorForm() {
  return (
    <FormStack>
      <UptimeRegionWarning />
      <UptimeDetectorFormDetectSection />
      <UptimeDetectorFormRespondSection />
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
      initialFormData={{
        name: 'New Monitor',
        downtimeThreshold: UPTIME_DEFAULT_DOWNTIME_THRESHOLD,
        recoveryThreshold: UPTIME_DEFAULT_RECOVERY_THRESHOLD,
      }}
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
