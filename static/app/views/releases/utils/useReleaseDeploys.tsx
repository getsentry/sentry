import type {Deploy} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

export function useReleaseDeploys({
  release,
  projectSlug,
}: {
  projectSlug: string | undefined;
  release: string;
}) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug});

  return useApiQuery<Deploy[]>(
    [
      `/organizations/${organization.slug}/releases/${encodeURIComponent(release)}/deploys/`,
      {
        query: {
          project: project?.id, // Should be disabled if project is undefined
        },
      },
    ],
    {
      staleTime: Infinity,
      enabled: !!project,
    }
  );
}
