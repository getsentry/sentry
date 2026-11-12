import {useTheme} from '@emotion/react';

import {Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {AutomateSectionDeprecated} from 'sentry/views/detectors/components/forms/automateSection';
import {useInitialDetectorDraft} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import {IssueOwnershipSection} from 'sentry/views/detectors/components/forms/common/issueOwnershipSection';
import {
  ProjectEnvironmentSection,
  type EnvironmentConfig,
} from 'sentry/views/detectors/components/forms/common/projectEnvironmentSection';
import {useSetAutomaticName} from 'sentry/views/detectors/components/forms/common/useSetAutomaticName';
import {useStepCounter} from 'sentry/views/detectors/components/forms/common/useStepCounter';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';
import {createMapFormErrors} from 'sentry/views/detectors/components/uptime/formErrors';
import {
  PreviewCheckResultProvider,
  usePreviewCheckResult,
} from 'sentry/views/detectors/components/uptime/previewCheckContext';
import {useUptimeAssertionFeatures} from 'sentry/views/detectors/components/uptime/useUptimeAssertionFeatures';

import {ConnectedTestUptimeMonitorButton} from './connectedTestUptimeMonitorButton';
import {UptimeDetectorFormDetectSection} from './detect';
import {uptimeFormDataToEndpointPayload, uptimeSavedDetectorToFormData} from './fields';
import {formatUptimeUrl} from './formatUptimeUrl';
import {PreviewSection} from './previewSection';
import {UptimeRegionWarning} from './regionWarning';
import {UptimeDetectorResolveSection} from './resolve';
import {
  getUptimeDuplicateFormData,
  UPTIME_DETECTOR_DRAFT_SCHEMA,
} from './uptimeDraftConfig';
import {UptimeIssuePreview} from './uptimeIssuePreview';
import {UptimeDetectorVerificationSection} from './verification';

const ENVIRONMENT_CONFIG: EnvironmentConfig = {
  includeAllEnvironments: false,
  fieldProps: {required: true},
};

function UptimeDetectorForm() {
  const theme = useTheme();
  const {hasRuntimeAssertions} = useUptimeAssertionFeatures();
  const nextStep = useStepCounter();

  useSetAutomaticName(form => {
    const url = form.getValue('url');

    if (typeof url !== 'string') {
      return null;
    }

    const urlName = formatUptimeUrl(url);
    if (!urlName) {
      return null;
    }

    return t('Uptime check for %s', urlName);
  });

  return (
    <Stack gap="2xl" maxWidth={theme.breakpoints.lg}>
      <UptimeRegionWarning />
      <PreviewSection />
      <ProjectEnvironmentSection step={nextStep()} environment={ENVIRONMENT_CONFIG} />
      <UptimeDetectorFormDetectSection step={nextStep()} />
      {hasRuntimeAssertions && <UptimeDetectorVerificationSection step={nextStep()} />}
      <UptimeDetectorResolveSection step={nextStep()} />
      <IssueOwnershipSection step={nextStep()} />
      <UptimeIssuePreview step={nextStep()} />
      <AutomateSectionDeprecated step={nextStep()} />
    </Stack>
  );
}

export function NewUptimeDetectorForm({
  duplicateDetector,
}: {
  duplicateDetector?: UptimeDetector;
}) {
  return (
    <PreviewCheckResultProvider>
      <NewUptimeDetectorFormContent duplicateDetector={duplicateDetector} />
    </PreviewCheckResultProvider>
  );
}

function NewUptimeDetectorFormContent({
  duplicateDetector,
}: {
  duplicateDetector?: UptimeDetector;
}) {
  const {hasRuntimeAssertions} = useUptimeAssertionFeatures();
  const previewCheckResult = usePreviewCheckResult();
  const draft = useInitialDetectorDraft();

  return (
    <NewDetectorLayout
      detectorType="uptime_domain_failure"
      draftSchema={UPTIME_DETECTOR_DRAFT_SCHEMA}
      formDataToEndpointPayload={uptimeFormDataToEndpointPayload}
      initialFormData={
        duplicateDetector
          ? getUptimeDuplicateFormData(duplicateDetector, draft ?? undefined)
          : {}
      }
      extraFooterButton={
        hasRuntimeAssertions ? <ConnectedTestUptimeMonitorButton /> : undefined
      }
      mapFormErrors={createMapFormErrors(previewCheckResult)}
    >
      <UptimeDetectorForm />
    </NewDetectorLayout>
  );
}

export function EditExistingUptimeDetectorForm({detector}: {detector: UptimeDetector}) {
  return (
    <PreviewCheckResultProvider>
      <EditExistingUptimeDetectorFormContent detector={detector} />
    </PreviewCheckResultProvider>
  );
}

function EditExistingUptimeDetectorFormContent({detector}: {detector: UptimeDetector}) {
  const {hasRuntimeAssertions} = useUptimeAssertionFeatures();
  const previewCheckResult = usePreviewCheckResult();

  return (
    <EditDetectorLayout
      detector={detector}
      formDataToEndpointPayload={uptimeFormDataToEndpointPayload}
      savedDetectorToFormData={uptimeSavedDetectorToFormData}
      extraFooterButton={
        hasRuntimeAssertions ? <ConnectedTestUptimeMonitorButton size="sm" /> : undefined
      }
      mapFormErrors={createMapFormErrors(previewCheckResult)}
    >
      <UptimeDetectorForm />
    </EditDetectorLayout>
  );
}
