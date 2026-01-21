import * as Sentry from '@sentry/react';
import type {QueryClient} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {AutomationFormData} from 'sentry/views/automations/components/automationFormData';
import {fetchIssueStreamDetectorIdsForProjects} from 'sentry/views/automations/utils/fetchIssueStreamDetectorIdsForProjects';

type ResolveDetectorIdsForProjectsParams = {
  formData: AutomationFormData;
  orgSlug: string;
  queryClient: QueryClient;
  onSubmitError?: (error: unknown) => void;
  projectIds?: string[];
};

/**
 * If the user selected by project, we need to convert to detector IDs,
 * which is done on form submission. This util modifes the form data
 * and handles any errors that may occur.
 */
export async function resolveDetectorIdsForProjects({
  formData,
  onSubmitError,
  orgSlug,
  projectIds,
  queryClient,
}: ResolveDetectorIdsForProjectsParams): Promise<AutomationFormData | null> {
  if (!projectIds?.length) {
    return formData;
  }

  try {
    const detectorIds = await fetchIssueStreamDetectorIdsForProjects({
      queryClient,
      orgSlug,
      projectIds,
    });
    return {...formData, detectorIds};
  } catch (error) {
    Sentry.captureException(error);
    onSubmitError?.(error);
    addErrorMessage(t('Something went wrong while saving selected projects'));
    return null;
  }
}
