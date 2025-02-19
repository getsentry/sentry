import {dropUndefinedKeys} from '@sentry/core';
import type {Location, LocationDescriptor, Path} from 'history';

import type {Organization} from 'sentry/types/organization';
import type {Trace} from 'sentry/types/profiling/core';
import type {Project} from 'sentry/types/project';
import {
  isContinuousProfileReference,
  isTransactionProfileReference,
} from 'sentry/utils/profiling/guards/profile';

const LEGACY_PROFILING_BASE_PATHNAME = 'profiling';
const PROFILING_BASE_PATHNAME = 'explore/profiling';

export function generateProfilingRoute({
  organization,
}: {
  organization: Organization;
}): Path {
  if (organization.features.includes('navigation-sidebar-v2')) {
    return `/organizations/${organization.slug}/${PROFILING_BASE_PATHNAME}/`;
  }

  return `/organizations/${organization.slug}/${LEGACY_PROFILING_BASE_PATHNAME}/`;
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
  if (organization.features.includes('navigation-sidebar-v2')) {
    return `/organizations/${organization.slug}/${PROFILING_BASE_PATHNAME}/profile/${projectSlug}/${profileId}/flamegraph/`;
  }

  return `/organizations/${organization.slug}/${LEGACY_PROFILING_BASE_PATHNAME}/profile/${projectSlug}/${profileId}/flamegraph/`;
}

export function generateContinuousProfileFlamechartRoute({
  organization,
  projectSlug,
}: {
  organization: Organization;
  projectSlug: Project['slug'];
}): string {
  if (organization.features.includes('navigation-sidebar-v2')) {
    return `/organizations/${organization.slug}/${PROFILING_BASE_PATHNAME}/profile/${projectSlug}/flamegraph/`;
  }

  return `/organizations/${organization.slug}/${LEGACY_PROFILING_BASE_PATHNAME}/profile/${projectSlug}/flamegraph/`;
}

export function generateProfileDifferentialFlamegraphRoute({
  organization,
  projectSlug,
}: {
  organization: Organization;
  projectSlug: Project['slug'];
}): string {
  if (organization.features.includes('navigation-sidebar-v2')) {
    return `/organizations/${organization.slug}/${PROFILING_BASE_PATHNAME}/profile/${projectSlug}/differential-flamegraph/`;
  }

  return `/organizations/${organization.slug}/${LEGACY_PROFILING_BASE_PATHNAME}/profile/${projectSlug}/differential-flamegraph/`;
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

export function generateProfileDetailsRoute({
  organization,
  projectSlug,
  profileId,
}: {
  organization: Organization;
  profileId: Trace['id'];
  projectSlug: Project['slug'];
}): string {
  if (organization.features.includes('navigation-sidebar-v2')) {
    return `/organizations/${organization.slug}/${PROFILING_BASE_PATHNAME}/profile/${projectSlug}/${profileId}/details/`;
  }

  return `/organizations/${organization.slug}/${LEGACY_PROFILING_BASE_PATHNAME}/profile/${projectSlug}/${profileId}/details/`;
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
  frameName: string;
  framePackage: string | undefined;
  organization: Organization;
  projectSlug: Project['slug'];
  reference: Profiling.BaseProfileReference | Profiling.ProfileReference;
  query?: Location['query'];
}): LocationDescriptor {
  if (typeof reference === 'string') {
    return generateProfileFlamechartRouteWithHighlightFrame({
      organization,
      projectSlug,
      profileId: reference,
      frameName,
      framePackage,
      query,
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
      start: new Date(reference.start * 1e3).toISOString(),
      end: new Date(reference.end * 1e3).toISOString(),
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
