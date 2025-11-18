import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {CronDetector} from 'sentry/types/workflowEngine/detectors';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {AssignSection} from 'sentry/views/detectors/components/forms/common/assignSection';
import {DescribeSection} from 'sentry/views/detectors/components/forms/common/describeSection';
import {CronDetectorFormDetectSection} from 'sentry/views/detectors/components/forms/cron/detect';
import {
  CRON_DEFAULT_SCHEDULE_TYPE,
  cronFormDataToEndpointPayload,
  cronSavedDetectorToFormData,
} from 'sentry/views/detectors/components/forms/cron/fields';
import {CronDetectorFormResolveSection} from 'sentry/views/detectors/components/forms/cron/resolve';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';

function CronDetectorForm({detector}: {detector?: CronDetector}) {
  const dataSource = detector?.dataSources[0];

  return (
    <FormStack>
      {dataSource?.queryObj.isUpserting && (
        <Alert type="warning">
          {t(
            'This monitor is managed in code and updates automatically with each check-in. Changes made here may be overwritten!'
          )}
        </Alert>
      )}
      <CronDetectorFormDetectSection />
      <CronDetectorFormResolveSection />
      <AssignSection />
      <DescribeSection />
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
      <CronDetectorForm />
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
      <CronDetectorForm detector={detector} />
    </EditDetectorLayout>
  );
}

const FormStack = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  max-width: ${p => p.theme.breakpoints.xl};
`;
