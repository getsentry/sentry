import {hasEveryAccess} from 'sentry/components/acl/access';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  project: Project | null | undefined;
}

export default function useDeleteReplayHasAccess({project}: Props) {
  const organization = useOrganization();

  return (
    hasEveryAccess(['project:write'], {organization, project}) ||
    hasEveryAccess(['project:admin'], {organization, project})
  );
}
