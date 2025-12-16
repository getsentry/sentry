import {useCallback} from 'react';

import useFetchSequentialPages from 'sentry/utils/api/useFetchSequentialPages';
import {
  fetchMutation,
  useMutation,
  type UseMutationOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type AutofixAutomationTuning =
  | 'off'
  | 'super_low' // deprecated
  | 'low' // deprecated
  | 'medium'
  | 'high' // deprecated
  | 'always' // deprecated
  | null; // deprecated

type AutomatedRunStoppingPoint =
  | 'root_cause'
  | 'solution'
  | 'code_changes'
  | 'open_pr'
  | 'background_agent';

export type AutofixAutomationSettings = {
  autofixAutomationTuning: AutofixAutomationTuning;
  automatedRunStoppingPoint: AutomatedRunStoppingPoint;
  projectId: string;
  reposCount: number;
};

/**
 * Fetch all autofix related settings for all projects.
 *
 * This returns a list of objects with the following properties:
 * - projectId: the project ID
 * - autofixAutomationTuning: the tuning setting for automated autofix
 * - automatedRunStoppingPoint: the stopping point for automated runs
 * - reposCount: the number of repositories configured for the project
 */
export function useGetBulkAutofixAutomationSettings() {
  const organization = useOrganization();

  return useFetchSequentialPages<AutofixAutomationSettings[]>({
    enabled: true,
    perPage: 100,
    getQueryKey: useCallback(
      ({cursor, per_page}: {cursor: string; per_page: number}) => [
        `/organizations/${organization.slug}/autofix/automation-settings/`,
        {query: {cursor, per_page}},
      ],
      [organization.slug]
    ),
  });
}

type AutofixAutomationUpdate =
  | {
      autofixAutomationTuning: AutofixAutomationTuning;
      projectIds: string[];
      automatedRunStoppingPoint?: never;
    }
  | {
      automatedRunStoppingPoint: AutomatedRunStoppingPoint;
      projectIds: string[];
      autofixAutomationTuning?: never;
    }
  | {
      autofixAutomationTuning: AutofixAutomationTuning;
      automatedRunStoppingPoint: AutomatedRunStoppingPoint;
      projectIds: string[];
    };

export function useUpdateBulkAutofixAutomationSettings(
  options?: Omit<
    UseMutationOptions<unknown, Error, AutofixAutomationUpdate, unknown>,
    'mutationFn'
  >
) {
  const organization = useOrganization();

  return useMutation<unknown, Error, AutofixAutomationUpdate, unknown>({
    mutationFn: (data: AutofixAutomationUpdate) => {
      return fetchMutation({
        method: 'POST',
        url: `/organizations/${organization.slug}/autofix/automation-settings/`,
        data,
      });
    },
    ...options,
  });
}
