import {Organization, Project} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';

export function generateFlamegraphRoute({
  orgSlug,
  projectSlug,
  profileId,
}: {
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
}) {
  return `/organizations/${orgSlug}/profiling/flamegraph/${projectSlug}/${profileId}/`;
}
