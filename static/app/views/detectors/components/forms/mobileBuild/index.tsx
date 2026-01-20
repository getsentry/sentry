import {useTheme} from '@emotion/react';

import {Stack} from 'sentry/components/core/layout';
import type {PreprodDetector} from 'sentry/types/workflowEngine/detectors';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {AssignSection} from 'sentry/views/detectors/components/forms/common/assignSection';
import {DescribeSection} from 'sentry/views/detectors/components/forms/common/describeSection';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {MobileBuildDetectSection} from 'sentry/views/detectors/components/forms/mobileBuild/detectSection';
import {
  PREPROD_DEFAULT_FORM_DATA,
  preprodFormDataToEndpointPayload,
  preprodSavedDetectorToFormData,
} from 'sentry/views/detectors/components/forms/mobileBuild/mobileBuildFormData';
import {MobileBuildPreviewSection} from 'sentry/views/detectors/components/forms/mobileBuild/previewSection';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';

function MobileBuildDetectorForm() {
  const theme = useTheme();

  return (
    <Stack gap="2xl" maxWidth={theme.breakpoints.lg}>
      <MobileBuildDetectSection />
      <MobileBuildPreviewSection />
      <AssignSection />
      <DescribeSection />
      <AutomateSection />
    </Stack>
  );
}

export function NewPreprodDetectorForm() {
  return (
    <NewDetectorLayout
      detectorType="preprod_static"
      formDataToEndpointPayload={preprodFormDataToEndpointPayload}
      initialFormData={PREPROD_DEFAULT_FORM_DATA}
      noEnvironment
    >
      <MobileBuildDetectorForm />
    </NewDetectorLayout>
  );
}

export function EditExistingPreprodDetectorForm({detector}: {detector: PreprodDetector}) {
  return (
    <EditDetectorLayout
      detector={detector}
      formDataToEndpointPayload={preprodFormDataToEndpointPayload}
      savedDetectorToFormData={preprodSavedDetectorToFormData}
      noEnvironment
    >
      <MobileBuildDetectorForm />
    </EditDetectorLayout>
  );
}
