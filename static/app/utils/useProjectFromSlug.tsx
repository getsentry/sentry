import {Organization} from 'sentry/types';
import useProjects from 'sentry/utils/useProjects';

function useProjectFromSlug({
  organization,
  projectSlug,
}: {
  organization: Organization;
  projectSlug: undefined | string;
}) {
  const {fetching, projects} = useProjects({
    slugs: projectSlug ? [projectSlug] : undefined,
    orgId: organization.slug,
  });
  return fetching ? undefined : projects[0];
}

export default useProjectFromSlug;
