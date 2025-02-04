import {dropUndefinedKeys} from '@sentry/core';
import type {Location, LocationDescriptor, Path} from 'history';

import type {Organization} from 'sentry/types/organization';
import type {Trace} from 'sentry/types/profiling/core';
import type {Project} from 'sentry/types/project';
import {
  isContinuousProfileReference,
  isTransactionProfileReference,
} from 'sentry/utils/profiling/guards/profile';

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
  return `/organizations/${orgSlug}/profiling/profile/${projectSlug}/${profileId}/flamegraph/`;
}

export function generateContinuousProfileFlamechartRoute({
  orgSlug,
  projectSlug,
}: {
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
}): string {
  return `/organizations/${orgSlug}/profiling/profile/${projectSlug}/flamegraph/`;
}

export function generateProfileDifferentialFlamegraphRoute({
  orgSlug,
  projectSlug,
}: {
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
}): string {
  return `/organizations/${orgSlug}/profiling/profile/${projectSlug}/differential-flamegraph/`;
}

export function generateProfileDifferentialFlamegraphRouteWithQuery({
  orgSlug,
  projectSlug,
  query,
  fingerprint,
  transaction,
  breakpoint,
}: {
  breakpoint: number;
  fingerprint: number;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  transaction: string;
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateProfileDifferentialFlamegraphRoute({orgSlug, projectSlug});
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
    query,
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
    query,
  };
}

export function generateContinuousProfileFlamechartRouteWithQuery({
  orgSlug,
  projectSlug,
  profilerId,
  start,
  end,
  query,
  frameName,
  framePackage,
}: {
  end: string;
  orgSlug: Organization['slug'];
  profilerId: string;
  projectSlug: Project['slug'];
  start: string;
  frameName?: string;
  framePackage?: string | undefined;
  query?: Location['query'];
}): LocationDescriptor {
  const pathname = generateContinuousProfileFlamechartRoute({
    orgSlug,
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
  orgSlug,
  projectSlug,
  profileId,
  frameName,
  framePackage,
  query,
}: {
  frameName: string;
  framePackage: string | undefined;
  orgSlug: Organization['slug'];
  profileId: Trace['id'];
  projectSlug: Project['slug'];
  query?: Location['query'];
}): LocationDescriptor {
  return generateProfileFlamechartRouteWithQuery({
    orgSlug,
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
  orgSlug,
  projectSlug,
  frameName,
  framePackage,
  reference,
  query,
}: {
  frameName: string;
  framePackage: string | undefined;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  reference: Profiling.BaseProfileReference | Profiling.ProfileReference;
  query?: Location['query'];
}): LocationDescriptor {
  if (typeof reference === 'string') {
    return generateProfileFlamechartRouteWithHighlightFrame({
      orgSlug,
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
      orgSlug,
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
      orgSlug,
      projectSlug,
      profileId: reference.profile_id,
      query: dropUndefinedKeys({...query, frameName, framePackage}),
    });
  }

  throw new Error('Not implemented');
}
