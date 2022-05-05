import {Location, LocationDescriptor, Path} from 'history';

import {Organization, Project} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';

export function generateProfilingRoute({orgSlug}: {orgSlug: Organization['slug']}): Path {
  return `/organizations/${orgSlug}/profiling/`;
}

export function generateFunctionsRoute({
  orgSlug,
  projectSlug,
}: {
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
}): Path {
  return `/organizations/${orgSlug}/profiling/functions/${projectSlug}/`;
}

export function generateFlamegraphRoute({
  orgSlug,
  projectSlug,
  profileId,
}: {
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
}): Path {
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

export function functionsRouteWithQuery({
  location,
  orgSlug,
  projectSlug,
  transaction,
  version,
}: {
  location: Location;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  transaction: string;
  version: string;
}): LocationDescriptor {
  const pathname = generateFunctionsRoute({orgSlug, projectSlug});
  return {
    pathname,
    query: {
      ...location.query,
      transaction,
      version,
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
