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
}): string {
  return `/organizations/${orgSlug}/profiling/flamegraph/${projectSlug}/${profileId}/flamegraph/`;
}

export function generateFlamegraphSummaryRoute({
  orgSlug,
  projectSlug,
  profileId,
}: {
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
}): string {
  return `/organizations/${orgSlug}/profiling/flamegraph/${projectSlug}/${profileId}/summary/`;
}

export function generateProfilingRouteWithQuery({
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

export function generateFunctionsRouteWithQuery({
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

export function generateFlamegraphRouteWithQuery({
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

export function generateFlamegraphSummaryRouteWithQuery({
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
  const pathname = generateFlamegraphSummaryRoute({orgSlug, projectSlug, profileId});
  return {
    pathname,
    query: {
      ...location.query,
    },
  };
}
