import {useTheme} from '@emotion/react';

import {Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {createMapFormErrors} from 'sentry/views/alerts/rules/uptime/formErrors';
import {
  PreviewCheckResultProvider,
  usePreviewCheckResult,
} from 'sentry/views/alerts/rules/uptime/previewCheckContext';
import {useUptimeAssertionFeatures} from 'sentry/views/alerts/rules/uptime/useUptimeAssertionFeatures';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {IssueOwnershipSection} from 'sentry/views/detectors/components/forms/common/issueOwnershipSection';
import {
  ProjectEnvironmentSection,
  type EnvironmentConfig,
} from 'sentry/views/detectors/components/forms/common/projectEnvironmentSection';
import {useSetAutomaticName} from 'sentry/views/detectors/components/forms/common/useSetAutomaticName';
import {useStepCounter} from 'sentry/views/detectors/components/forms/common/useStepCounter';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';
import {ConnectedTestUptimeMonitorButton} from 'sentry/views/detectors/components/forms/uptime/connectedTestUptimeMonitorButton';
import {UptimeDetectorFormDetectSection} from 'sentry/views/detectors/components/forms/uptime/detect';
import {
  uptimeFormDataToEndpointPayload,
  uptimeSavedDetectorToFormData,
} from 'sentry/views/detectors/components/forms/uptime/fields';
import {formatUptimeUrl} from 'sentry/views/detectors/components/forms/uptime/formatUptimeUrl';
import {PreviewSection} from 'sentry/views/detectors/components/forms/uptime/previewSection';
import {UptimeRegionWarning} from 'sentry/views/detectors/components/forms/uptime/regionWarning';
import {UptimeDetectorResolveSection} from 'sentry/views/detectors/components/forms/uptime/resolve';
import {UptimeIssuePreview} from 'sentry/views/detectors/components/forms/uptime/uptimeIssuePreview';
import {UptimeDetectorVerificationSection} from 'sentry/views/detectors/components/forms/uptime/verification';

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
      <AutomateSection step={nextStep()} />
    </Stack>
  );
}

export function NewUptimeDetectorForm() {
  return (
    <PreviewCheckResultProvider>
      <NewUptimeDetectorFormContent />
    </PreviewCheckResultProvider>
  );
}

function NewUptimeDetectorFormContent() {
  const {hasRuntimeAssertions} = useUptimeAssertionFeatures();
  const previewCheckResult = usePreviewCheckResult();

  return (
    <NewDetectorLayout
      detectorType="uptime_domain_failure"
      formDataToEndpointPayload={uptimeFormDataToEndpointPayload}
      initialFormData={{}}
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
