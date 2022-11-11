import {Location, LocationDescriptor, Path} from 'history';

import type {Organization, Project} from 'sentry/types';
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

export function generateProfileFlamechartRoute({
  orgSlug,
  projectSlug,
  profileId,
}: {
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
}): string {
  return `/organizations/${orgSlug}/profiling/profile/${projectSlug}/${profileId}/flamechart/`;
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
  orgSlug,
  query,
}: {
  orgSlug: Organization['slug'];
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateProfilingRoute({orgSlug});
  return {
    pathname,
    query: {
      ...query,
    },
  };
}

export function generateProfileSummaryRouteWithQuery({
  orgSlug,
  projectSlug,
  transaction,
  query,
}: {
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  transaction: string;
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateProfileSummaryRoute({orgSlug, projectSlug});
  return {
    pathname,
    query: {
      ...query,
      transaction,
    },
  };
}

export function generateProfileFlamechartRouteWithQuery({
  orgSlug,
  projectSlug,
  profileId,
  query,
}: {
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateProfileFlamechartRoute({
    orgSlug,
    projectSlug,
    profileId,
  });
  return {
    pathname,
    query: {
      ...query,
    },
  };
}

export function generateProfileDetailsRouteWithQuery({
  orgSlug,
  projectSlug,
  profileId,
  query,
}: {
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateProfileDetailsRoute({orgSlug, projectSlug, profileId});
  return {
    pathname,
    query: {
      ...query,
    },
  };
}
