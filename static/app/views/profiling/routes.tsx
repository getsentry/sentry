import {Location, LocationDescriptor} from 'history';

import {Organization, Project} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';

export function generateProfilingRoute({
  orgSlug,
}: {
  orgSlug: Organization['slug'];
}): string {
  return `/organizations/${orgSlug}/profiling/`;
}

export function generateFlamegraphRoute({
  orgSlug,
  projectSlug,
  profileId,
}: {
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
}): string {
  return `/organizations/${orgSlug}/profiling/flamegraph/${projectSlug}/${profileId}/`;
}

export function profilingRouteWithQuery({
  location,
  orgSlug,
}: {
  location: Location;
  orgSlug: Organization['slug'];
}): LocationDescriptor {
  const pathname = generateProfilingRoute({orgSlug});
  return {
    pathname,
    query: {
      ...location.query,
    },
  };
}

export function flamegraphRouteWithQuery({
  location,
  orgSlug,
  projectSlug,
  profileId,
}: {
  location: Location;
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
}): LocationDescriptor {
  const pathname = generateFlamegraphRoute({orgSlug, projectSlug, profileId});
  return {
    pathname,
    query: {
      ...location.query,
    },
  };
}
