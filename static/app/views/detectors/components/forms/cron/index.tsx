import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {Alert} from 'sentry/components/core/alert';
import {Stack} from 'sentry/components/core/layout';
import {t} from 'sentry/locale';
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
import {InstrumentationGuide} from 'sentry/views/detectors/components/forms/cron/instrumentationGuide';
import {CronDetectorFormResolveSection} from 'sentry/views/detectors/components/forms/cron/resolve';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';
import {useCronsUpsertGuideState} from 'sentry/views/insights/crons/components/useCronsUpsertGuideState';

import {PreviewSection} from './previewSection';

function useIsShowingPlatformGuide() {
  const {platformKey, guideKey} = useCronsUpsertGuideState();
  return platformKey && guideKey !== 'manual';
}

function CronDetectorForm({detector}: {detector?: CronDetector}) {
  const dataSource = detector?.dataSources[0];
  const theme = useTheme();
  const showingPlatformGuide = useIsShowingPlatformGuide();

  const formSections = (
    <Fragment>
      {dataSource?.queryObj.isUpserting && (
        <Alert variant="warning">
          {t(
            'This monitor is managed in code and updates automatically with each check-in. Changes made here may be overwritten!'
          )}
        </Alert>
      )}
      <PreviewSection />
      <CronDetectorFormDetectSection />
      <CronDetectorFormResolveSection />
      <AssignSection />
      <DescribeSection />
      <AutomateSection />
    </Fragment>
  );

  return (
    <Stack gap="2xl" maxWidth={theme.breakpoints.xl}>
      {!detector && <InstrumentationGuide />}
      {!showingPlatformGuide && formSections}
    </Stack>
  );
}

export function NewCronDetectorForm() {
  const showingPlatformGuide = useIsShowingPlatformGuide();

  return (
    <NewDetectorLayout
      detectorType="monitor_check_in_failure"
      formDataToEndpointPayload={cronFormDataToEndpointPayload}
      initialFormData={{
        scheduleType: CRON_DEFAULT_SCHEDULE_TYPE,
      }}
      noEnvironment
      disabledCreate={
        showingPlatformGuide
          ? t(
              'Using Auto-Instrumentation does not require you to create a monitor via the Sentry UI'
            )
          : undefined
      }
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
      noEnvironment
    >
      <CronDetectorForm detector={detector} />
    </EditDetectorLayout>
  );
}
