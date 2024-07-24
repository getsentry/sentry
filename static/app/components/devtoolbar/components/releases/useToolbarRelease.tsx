import type {Release} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';

import useConfiguration from '../../hooks/useConfiguration';

export default function useToolbarRelease() {
  const {organizationSlug, projectSlug} = useConfiguration();

  return useApiQuery<Release[]>(
    [
      `/organizations/${organizationSlug}/releases/`,
      {
        query: {
          queryReferrer: 'devtoolbar',
          projectSlug,
        },
      },
    ],
    {
      staleTime: Infinity,
      retry: false,
    }
  );
}
