import {dropUndefinedKeys} from '@sentry/core';
import type {Location, LocationDescriptor, Path} from 'history';

import type {Organization} from 'sentry/types/organization';
import type {Trace} from 'sentry/types/profiling/core';
import type {Project} from 'sentry/types/project';
import {
  isContinuousProfileReference,
  isTransactionProfileReference,
} from 'sentry/utils/profiling/guards/profile';

const PROFILING_BASE_PATHNAME = 'explore/profiling';

function generateProfilingRoute({organization}: {organization: Organization}): Path {
  return `/organizations/${organization.slug}/${PROFILING_BASE_PATHNAME}/`;
}

export function generateProfileFlamechartRoute({
  organization,
  projectSlug,
  profileId,
}: {
  organization: Organization;
  profileId: Trace['id'];
  projectSlug: Project['slug'];
}): string {
  return `/organizations/${organization.slug}/${PROFILING_BASE_PATHNAME}/profile/${projectSlug}/${profileId}/flamegraph/`;
}

function generateContinuousProfileFlamechartRoute({
  organization,
  projectSlug,
}: {
  organization: Organization;
  projectSlug: Project['slug'];
}): string {
  return `/organizations/${organization.slug}/${PROFILING_BASE_PATHNAME}/profile/${projectSlug}/flamegraph/`;
}

function generateProfileDifferentialFlamegraphRoute({
  organization,
  projectSlug,
}: {
  organization: Organization;
  projectSlug: Project['slug'];
}): string {
  return `/organizations/${organization.slug}/${PROFILING_BASE_PATHNAME}/profile/${projectSlug}/differential-flamegraph/`;
}

export function generateProfileDifferentialFlamegraphRouteWithQuery({
  organization,
  projectSlug,
  query,
  fingerprint,
  transaction,
  breakpoint,
}: {
  breakpoint: number;
  fingerprint: number;
  organization: Organization;
  projectSlug: Project['slug'];
  transaction: string;
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateProfileDifferentialFlamegraphRoute({
    organization,
    projectSlug,
  });
  return {
    pathname,
    query: {
      ...query,
      transaction,
      fingerprint,
      breakpoint,
    },
  };
}

export function generateProfilingRouteWithQuery({
  organization,
  query,
}: {
  organization: Organization;
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateProfilingRoute({organization});
  return {
    pathname,
    query,
  };
}

export function generateProfileFlamechartRouteWithQuery({
  organization,
  projectSlug,
  profileId,
  query,
}: {
  organization: Organization;
  profileId: Trace['id'];
  projectSlug: Project['slug'];
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateProfileFlamechartRoute({
    organization,
    projectSlug,
    profileId,
  });
  return {
    pathname,
    query,
  };
}

export function generateContinuousProfileFlamechartRouteWithQuery({
  organization,
  projectSlug,
  profilerId,
  start,
  end,
  query,
  frameName,
  framePackage,
}: {
  end: string;
  organization: Organization;
  profilerId: string;
  projectSlug: Project['slug'];
  start: string;
  frameName?: string;
  framePackage?: string | undefined;
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateContinuousProfileFlamechartRoute({
    organization,
    projectSlug,
  });

  return {
    pathname,
    query: dropUndefinedKeys({
      profilerId,
      start,
      end,
      frameName,
      framePackage,
      ...query,
    }),
  };
}

export function generateProfileFlamechartRouteWithHighlightFrame({
  organization,
  projectSlug,
  profileId,
  frameName,
  framePackage,
  query,
}: {
  frameName: string;
  framePackage: string | undefined;
  organization: Organization;
  profileId: Trace['id'];
  projectSlug: Project['slug'];
  query?: Location['query'];
}): LocationDescriptor {
  return generateProfileFlamechartRouteWithQuery({
    organization,
    projectSlug,
    profileId,
    query: {
      ...query,
      frameName,
      framePackage,
    },
  });
}

export function generateProfileRouteFromProfileReference({
  organization,
  projectSlug,
  frameName,
  framePackage,
  reference,
  query,
}: {
  organization: Organization;
  projectSlug: Project['slug'];
  reference: Profiling.BaseProfileReference | Profiling.ProfileReference;
  frameName?: string;
  framePackage?: string;
  query?: Location['query'];
}): LocationDescriptor {
  if (typeof reference === 'string') {
    return generateProfileFlamechartRouteWithQuery({
      organization,
      projectSlug,
      profileId: reference,
      query: {
        ...query,
        frameName,
        framePackage,
      },
    });
  }

  if (isContinuousProfileReference(reference)) {
    const eventId = 'transaction_id' in reference ? reference.transaction_id : undefined;

    return generateContinuousProfileFlamechartRouteWithQuery({
      organization,
      projectSlug,
      profilerId: reference.profiler_id,
      frameName,
      framePackage,
      // when converting to a timestamp, we round the start timestamp down and round
      // the end timestamp up to the millisecond to ensure we capture the full profile
      start: new Date(Math.floor(reference.start * 1e3)).toISOString(),
      end: new Date(Math.ceil(reference.end * 1e3)).toISOString(),
      query: dropUndefinedKeys({
        ...query,
        frameName,
        framePackage,
        eventId,
        tid: reference.thread_id as unknown as string,
      }),
    });
  }

  if (isTransactionProfileReference(reference)) {
    return generateProfileFlamechartRouteWithQuery({
      organization,
      projectSlug,
      profileId: reference.profile_id,
      query: dropUndefinedKeys({...query, frameName, framePackage}),
    });
  }

  throw new Error('Not implemented');
}
