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

export function generateProfileFlamegraphRoute({
  orgSlug,
  projectSlug,
  profileId,
}: {
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
}): string {
  return `/organizations/${orgSlug}/profiling/profile/${projectSlug}/${profileId}/flamegraph/`;
}

export function generateProfileDetailsRoute({
  orgSlug,
  projectSlug,
  profileId,
}: {
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
}): string {
  return `/organizations/${orgSlug}/profiling/profile/${projectSlug}/${profileId}/details/`;
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

export function generateProfileFlamegraphRouteWithQuery({
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
  const pathname = generateProfileFlamegraphRoute({orgSlug, projectSlug, profileId});
  return {
    pathname,
    query: {
      ...location?.query,
      ...query,
    },
  };
}

export function generateProfileDetailsRouteWithQuery({
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
  const pathname = generateProfileDetailsRoute({orgSlug, projectSlug, profileId});
  return {
    pathname,
    query: {
      ...location?.query,
      ...query,
    },
  };
}
