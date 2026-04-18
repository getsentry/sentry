import {useTheme} from '@emotion/react';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {CronDetector} from 'sentry/types/workflowEngine/detectors';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {IssueOwnershipSection} from 'sentry/views/detectors/components/forms/common/issueOwnershipSection';
import {ProjectSection} from 'sentry/views/detectors/components/forms/common/projectSection';
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

import {CronIssuePreview} from './cronIssuePreview';
import {PreviewSection} from './previewSection';

function useIsShowingPlatformGuide() {
  const {platformKey, guideKey} = useCronsUpsertGuideState();
  return platformKey && guideKey !== 'manual';
}

const FORM_SECTIONS = [
  ProjectSection,
  CronDetectorFormDetectSection,
  CronDetectorFormResolveSection,
  IssueOwnershipSection,
  CronIssuePreview,
  AutomateSection,
];
/**
 * Maps API errors in the `dataSources` property to the correct form fields.
 * For Crons, `slug` may return error messages, and we want those to show
 * up under the `name` field.
 *
 * TODO: When converting to the new form components, find a less fragile way to do this.
 */
const mapCronDetectorFormErrors = (error: unknown) => {
  if (typeof error !== 'object' || error === null) {
    return error;
  }

  if ('dataSources' in error) {
    if (typeof error.dataSources === 'object' && error.dataSources !== null) {
      if ('slug' in error.dataSources) {
        return {...error, name: error.dataSources.slug};
      }
      return {...error, ...error.dataSources};
    }
  }
  return error;
};

function CronDetectorForm({detector}: {detector?: CronDetector}) {
  const dataSource = detector?.dataSources[0];
  const theme = useTheme();
  const showingPlatformGuide = useIsShowingPlatformGuide();

  return (
    <Stack gap="2xl" maxWidth={theme.breakpoints.xl}>
      {!detector && <InstrumentationGuide />}
      <Stack
        data-test-id="form-sections"
        style={showingPlatformGuide ? {display: 'none'} : undefined}
        gap="2xl"
      >
        {dataSource?.queryObj.isUpserting && (
          <Alert variant="warning">
            {t(
              'This monitor is managed in code and updates automatically with each check-in. Changes made here may be overwritten!'
            )}
          </Alert>
        )}
        <PreviewSection />
        {FORM_SECTIONS.map((FormSection, index) => (
          <FormSection key={index} step={index + 1} />
        ))}
      </Stack>
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
      mapFormErrors={mapCronDetectorFormErrors}
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
      mapFormErrors={mapCronDetectorFormErrors}
    >
      <CronDetectorForm detector={detector} />
    </EditDetectorLayout>
  );
}
