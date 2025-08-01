import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {CronDetector} from 'sentry/types/workflowEngine/detectors';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {AssignSection} from 'sentry/views/detectors/components/forms/common/assignSection';
import {CronDetectorFormDetectSection} from 'sentry/views/detectors/components/forms/cron/detect';
import {
  cronFormDataToEndpointPayload,
  cronSavedDetectorToFormData,
} from 'sentry/views/detectors/components/forms/cron/fields';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';

function CronDetectorForm({isEditing}: {isEditing: boolean}) {
  return (
    <FormStack>
      <CronDetectorFormDetectSection isEditing={isEditing} />
      <AssignSection />
      <AutomateSection />
    </FormStack>
  );
}

export function NewCronDetectorForm() {
  return (
    <NewDetectorLayout
      detectorType="uptime_subscription"
      formDataToEndpointPayload={cronFormDataToEndpointPayload}
      initialFormData={{
        scheduleCrontab: '0 0 * * *',
        scheduleIntervalValue: 1,
        scheduleIntervalUnit: 'day',
        scheduleType: 'crontab',
        timezone: 'UTC',
        failureIssueThreshold: 1,
        recoveryThreshold: 1,
        maxRuntime: 30,
        checkinMargin: 1,
        workflowIds: [],
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
