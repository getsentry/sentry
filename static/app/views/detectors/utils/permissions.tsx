import {hasEveryAccess} from 'sentry/components/acl/access';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

/** Checks monitor write access through the project or its organization. */
export function hasDetectorWriteAccess({
  organization,
  project,
}: {
  organization: Organization;
  project: Project;
}): boolean {
  return hasEveryAccess(['alerts:write'], {organization, project});
}
