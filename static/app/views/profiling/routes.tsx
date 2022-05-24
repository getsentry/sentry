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
  query,
}: {
  orgSlug: Organization['slug'];
  location?: Location;
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateProfilingRoute({orgSlug});
  return {
    pathname,
    query: {
      ...location?.query,
      ...query,
    },
  };
}

export function generateFunctionsRouteWithQuery({
  location,
  orgSlug,
  projectSlug,
  transaction,
  version,
  query,
}: {
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  transaction: string;
  version: string;
  location?: Location;
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateFunctionsRoute({orgSlug, projectSlug});
  return {
    pathname,
    query: {
      ...location?.query,
      ...query,
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
  query,
}: {
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
  location?: Location;
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateFlamegraphRoute({orgSlug, projectSlug, profileId});
  return {
    pathname,
    query: {
      ...location?.query,
      ...query,
    },
  };
}

export function generateFlamegraphSummaryRouteWithQuery({
  location,
  orgSlug,
  projectSlug,
  profileId,
  query,
}: {
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
  location?: Location;
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateFlamegraphSummaryRoute({orgSlug, projectSlug, profileId});
  return {
    pathname,
    query: {
      ...location?.query,
      ...query,
    },
  };
}
