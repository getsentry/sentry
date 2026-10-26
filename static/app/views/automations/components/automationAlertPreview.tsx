import {useMemo} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Text} from '@sentry/scraps/text';

import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AutomationAlertPreviewTable} from 'sentry/views/automations/components/automationAlertPreviewTable';
import {useAutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import {getAlertPreviewRequest} from 'sentry/views/automations/components/automationFormData';
import {alertPreviewQueryOptions} from 'sentry/views/automations/utils/alertPreviewQueryOptions';

const PREVIEW_DEBOUNCE_MS = 500;
const EMPTY_IDS: readonly string[] = [];

export function AutomationAlertPreview() {
  const organization = useOrganization();
  const {state} = useAutomationBuilderContext();
  const projectIds = useFormField<string[]>('projectIds') ?? EMPTY_IDS;
  const detectorIds = useFormField<string[]>('detectorIds') ?? EMPTY_IDS;
  const allProjects = useFormField<boolean>('allProjects') ?? false;
  const environment = useFormField<string | null>('environment') ?? null;
  const frequency = useFormField<number | null>('frequency') ?? null;
  const isSpecificMonitorScope = detectorIds.length > 0 && projectIds.length === 0;

  const request = useMemo(
    () =>
      allProjects || isSpecificMonitorScope || environment
        ? null
        : getAlertPreviewRequest({frequency, projectIds, state}),
    [allProjects, environment, frequency, isSpecificMonitorScope, projectIds, state]
  );
  const [debouncedRequest, debouncer] = useDebouncedValue(
    request,
    {wait: PREVIEW_DEBOUNCE_MS},
    debounceState => ({isPending: debounceState.isPending})
  );
  const isDebouncing = debouncer.state.isPending;
  const {
    data: previews,
    error: previewError,
    isPending: isPreviewPending,
  } = useQuery(
    alertPreviewQueryOptions({
      organizationSlug: organization.slug,
      request: debouncedRequest,
    })
  );

  if (allProjects) {
    return (
      <Alert variant="muted">
        {t('Previews for alerts across all projects are not supported.')}
      </Alert>
    );
  }

  if (isSpecificMonitorScope) {
    return (
      <Alert variant="muted">
        {t('Previews for alerts connected to monitors are not supported.')}
      </Alert>
    );
  }

  if (environment) {
    return (
      <Alert variant="muted">
        {t('Previews for environment-specific alerts are not supported.')}
      </Alert>
    );
  }

  if (!request) {
    return (
      <Text variant="muted">
        {projectIds.length === 0
          ? t('Select at least one project to preview this alert.')
          : t('Complete the alert conditions to see a preview.')}
      </Text>
    );
  }

  if (previewError && !isDebouncing) {
    const isConfigurationError =
      previewError instanceof RequestError && previewError.status === 400;

    return (
      <Alert variant={isConfigurationError ? 'muted' : 'warning'}>
        {isConfigurationError
          ? t('Previews are not supported for these alert conditions.')
          : t('Could not load the alert preview.')}
      </Alert>
    );
  }

  return (
    <AutomationAlertPreviewTable
      key={JSON.stringify(debouncedRequest)}
      previews={previews}
      projectIds={request.projectIds}
      isLoading={isDebouncing || isPreviewPending}
    />
  );
}
