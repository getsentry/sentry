import {useCallback} from 'react';

import useFetchSequentialPages from 'sentry/utils/api/useFetchSequentialPages';
import useOrganization from 'sentry/utils/useOrganization';

type AutofixAutomationSettings = {
  fixes: boolean;
  prCreation: boolean;
  projectId: string;
  projectName: string;
  projectPlatform: string;
  projectSlug: string;
  reposCount: number;
  tuning: 'off' | 'super_low' | 'low' | 'medium' | 'high' | 'always';
};

export default function useAllAutofixAutomationSettings() {
  const organization = useOrganization();

  return useFetchSequentialPages<AutofixAutomationSettings>({
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
