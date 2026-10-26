import * as Sentry from '@sentry/react';
import type {QueryClient} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {AutomationFormData} from 'sentry/views/automations/components/automationFormData';
import {
  fetchIssueStreamDetectorIdsForProjects,
  fetchAllProjectsDetectorId,
} from 'sentry/views/automations/utils/fetchIssueStreamDetectorIds';

type ResolveDetectorIdsForProjectsParams = {
  formData: AutomationFormData;
  organization: Organization;
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
  organization,
  projectIds,
  queryClient,
}: ResolveDetectorIdsForProjectsParams): Promise<AutomationFormData | null> {
  if (formData.allProjects) {
    try {
      const detectorId = await fetchAllProjectsDetectorId({queryClient, organization});
      if (!detectorId) {
        throw new Error('All Projects detector not available');
      }
      return {...formData, detectorIds: [detectorId]};
    } catch (error) {
      Sentry.captureException(error);
      onSubmitError?.(error);
      addErrorMessage(t('Something went wrong while saving to all projects'));
      return null;
    }
  }

  if (!projectIds?.length) {
    return formData;
  }

  try {
    const detectorIds = await fetchIssueStreamDetectorIdsForProjects({
      queryClient,
      organization,
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
