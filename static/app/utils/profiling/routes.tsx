import {Location, LocationDescriptor, Path} from 'history';

import {Organization, Project} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';

export function generateProfilingRoute({orgSlug}: {orgSlug: Organization['slug']}): Path {
  return `/organizations/${orgSlug}/profiling/`;
}

export function generateProfileSummaryRoute({
  orgSlug,
  projectSlug,
}: {
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
}): Path {
  return `/organizations/${orgSlug}/profiling/summary/${projectSlug}/`;
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

export function generateProfileSummaryRouteWithQuery({
  location,
  orgSlug,
  projectSlug,
  transaction,
  query,
}: {
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  transaction: string;
  location?: Location;
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateProfileSummaryRoute({orgSlug, projectSlug});
  return {
    pathname,
    query: {
      ...location?.query,
      ...query,
      transaction,
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
