import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {CronDetector} from 'sentry/types/workflowEngine/detectors';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {AssignSection} from 'sentry/views/detectors/components/forms/common/assignSection';
import {CronDetectorFormDetectSection} from 'sentry/views/detectors/components/forms/cron/detect';
import {
  CRON_DEFAULT_SCHEDULE_TYPE,
  cronFormDataToEndpointPayload,
  cronSavedDetectorToFormData,
} from 'sentry/views/detectors/components/forms/cron/fields';
import {CronDetectorFormResolveSection} from 'sentry/views/detectors/components/forms/cron/resolve';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';

function CronDetectorForm({isEditing}: {isEditing: boolean}) {
  return (
    <FormStack>
      <CronDetectorFormDetectSection isEditing={isEditing} />
      <CronDetectorFormResolveSection />
      <AssignSection />
      <AutomateSection />
    </FormStack>
  );
}

export function NewCronDetectorForm() {
  return (
    <NewDetectorLayout
      detectorType="monitor_check_in_failure"
      formDataToEndpointPayload={cronFormDataToEndpointPayload}
      initialFormData={{
        scheduleType: CRON_DEFAULT_SCHEDULE_TYPE,
      }}
    >
      <CronDetectorForm isEditing={false} />
    </NewDetectorLayout>
  );
}

export function EditExistingCronDetectorForm({detector}: {detector: CronDetector}) {
  return (
    <EditDetectorLayout
      detector={detector}
      formDataToEndpointPayload={cronFormDataToEndpointPayload}
      savedDetectorToFormData={cronSavedDetectorToFormData}
    >
      <CronDetectorForm isEditing />
    </EditDetectorLayout>
  );
}

const FormStack = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  max-width: ${p => p.theme.breakpoints.xl};
`;
