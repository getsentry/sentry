import styled from '@emotion/styled';

import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {HTTPSnippet} from 'sentry/views/alerts/rules/uptime/httpSnippet';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {AssignSection} from 'sentry/views/detectors/components/forms/common/assignSection';
import {useSetAutomaticName} from 'sentry/views/detectors/components/forms/common/useSetAutomaticName';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';
import {UptimeDetectorFormDetectSection} from 'sentry/views/detectors/components/forms/uptime/detect';
import {
  uptimeFormDataToEndpointPayload,
  uptimeSavedDetectorToFormData,
} from 'sentry/views/detectors/components/forms/uptime/fields';
import {UptimeRegionWarning} from 'sentry/views/detectors/components/forms/uptime/regionWarning';
import {UptimeDetectorResolveSection} from 'sentry/views/detectors/components/forms/uptime/resolve';

const HTTP_METHODS_NO_BODY = ['GET', 'HEAD', 'OPTIONS'];

function ConnectedHttpSnippet() {
  const url = useFormField<string>('url');
  const method = useFormField<string>('method');
  const headers = useFormField<Array<[string, string]>>('headers');
  const body = useFormField<string>('body');
  const traceSampling = useFormField<boolean>('traceSampling');

  if (!url || !method) {
    return null;
  }

  const shouldIncludeBody = !HTTP_METHODS_NO_BODY.includes(method);

  return (
    <HTTPSnippet
      url={url}
      method={method}
      headers={headers ?? []}
      body={shouldIncludeBody ? (body ?? null) : null}
      traceSampling={traceSampling ?? false}
    />
  );
}

function UptimeDetectorForm() {
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
    <FormStack>
      <UptimeRegionWarning />
      <UptimeDetectorFormDetectSection />
      <ConnectedHttpSnippet />
      <UptimeDetectorResolveSection />
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
      initialFormData={{name: 'New Monitor'}}
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
  gap: ${p => p.theme.space['2xl']};
  max-width: ${p => p.theme.breakpoints.lg};
`;
