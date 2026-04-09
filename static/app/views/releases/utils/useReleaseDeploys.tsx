import {useQuery} from '@tanstack/react-query';

import {deployApiOptions} from 'sentry/utils/deployApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromSlug} from 'sentry/utils/useProjectFromSlug';

export function useReleaseDeploys({
  release,
  projectSlug,
}: {
  projectSlug: string | undefined;
  release: string;
}) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug});

  return useQuery({
    ...deployApiOptions({
      orgSlug: organization.slug,
      releaseVersion: release,
      // Should be disabled if project is undefined
      query: {project: project?.id},
    }),
    enabled: !!project,
  });
}
