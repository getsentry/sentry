import {useTheme} from '@emotion/react';

import {Stack} from 'sentry/components/core/layout';
import {t} from 'sentry/locale';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {mapAssertionFormErrors} from 'sentry/views/alerts/rules/uptime/assertionFormErrors';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {AssignSection} from 'sentry/views/detectors/components/forms/common/assignSection';
import {DescribeSection} from 'sentry/views/detectors/components/forms/common/describeSection';
import {useSetAutomaticName} from 'sentry/views/detectors/components/forms/common/useSetAutomaticName';
import type {DetectorBaseFields} from 'sentry/views/detectors/components/forms/detectorBaseFields';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';
import {ConnectedTestUptimeMonitorButton} from 'sentry/views/detectors/components/forms/uptime/connectedTestUptimeMonitorButton';
import {UptimeDetectorFormDetectSection} from 'sentry/views/detectors/components/forms/uptime/detect';
import {
  uptimeFormDataToEndpointPayload,
  uptimeSavedDetectorToFormData,
} from 'sentry/views/detectors/components/forms/uptime/fields';
import {PreviewSection} from 'sentry/views/detectors/components/forms/uptime/previewSection';
import {UptimeRegionWarning} from 'sentry/views/detectors/components/forms/uptime/regionWarning';
import {UptimeDetectorResolveSection} from 'sentry/views/detectors/components/forms/uptime/resolve';
import {UptimeDetectorVerificationSection} from 'sentry/views/detectors/components/forms/uptime/verification';

const ENVIRONMENT_CONFIG: React.ComponentProps<typeof DetectorBaseFields>['environment'] =
  {includeAllEnvironments: false, fieldProps: {required: true}};

function UptimeDetectorForm() {
  const theme = useTheme();

  useSetAutomaticName(form => {
    const url = form.getValue('url');

    if (typeof url !== 'string') {
      return null;
    }

    const parsedUrl = URL.parse(url);
    if (!parsedUrl) {
      return null;
    }

    const path = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname;
    const urlName = `${parsedUrl.hostname}${path}`.replace(/\/$/, '');

    return t('Uptime check for %s', urlName);
  });

  return (
    <Stack gap="2xl" maxWidth={theme.breakpoints.lg}>
      <UptimeRegionWarning />
      <PreviewSection />
      <UptimeDetectorFormDetectSection />
      <UptimeDetectorVerificationSection />
      <UptimeDetectorResolveSection />
      <AssignSection />
      <DescribeSection />
      <AutomateSection />
    </Stack>
  );
}

export function NewUptimeDetectorForm() {
  const organization = useOrganization();
  const showTestButton = organization.features.includes('uptime-runtime-assertions');

  return (
    <NewDetectorLayout
      detectorType="uptime_domain_failure"
      formDataToEndpointPayload={uptimeFormDataToEndpointPayload}
      initialFormData={{}}
      environment={ENVIRONMENT_CONFIG}
      extraFooterButton={
        showTestButton ? <ConnectedTestUptimeMonitorButton /> : undefined
      }
      mapFormErrors={mapAssertionFormErrors}
    >
      <UptimeDetectorForm />
    </NewDetectorLayout>
  );
}

export function EditExistingUptimeDetectorForm({detector}: {detector: UptimeDetector}) {
  const organization = useOrganization();
  const showTestButton = organization.features.includes('uptime-runtime-assertions');

  return (
    <EditDetectorLayout
      detector={detector}
      formDataToEndpointPayload={uptimeFormDataToEndpointPayload}
      savedDetectorToFormData={uptimeSavedDetectorToFormData}
      environment={ENVIRONMENT_CONFIG}
      extraFooterButton={
        showTestButton ? <ConnectedTestUptimeMonitorButton size="sm" /> : undefined
      }
      mapFormErrors={mapAssertionFormErrors}
    >
      <UptimeDetectorForm />
    </EditDetectorLayout>
  );
}
