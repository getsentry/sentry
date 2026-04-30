import {useMemo, useState} from 'react';
import {Outlet} from 'react-router-dom';

import {ProfileHeader} from 'sentry/components/profiling/profileHeader';
import type {RequestState} from 'sentry/types/core';
import {
  isEventedProfile,
  isJSProfile,
  isSampledProfile,
  isSchema,
  isSentrySampledProfile,
} from 'sentry/utils/profiling/guards/profile';
import {useTransactionAsSpans} from 'sentry/utils/profiling/hooks/useTransactionAsSpans';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {LayoutPageWithHiddenFooter} from 'sentry/views/explore/profiling/layoutPageWithHiddenFooter';

import {ProfileTransactionContext, TransactionProfileProvider} from './profilesProvider';

export default function ProfileAndTransactionProvider(): React.ReactElement {
  const organization = useOrganization();
  const params = useParams();

  const projectSlug = params.projectId!;
  const {projects} = useProjects({slugs: [projectSlug]});
  const projectIds = useMemo(() => projects.map(p => Number(p.id)), [projects]);

  const [profile, setProfile] = useState<RequestState<Profiling.ProfileInput>>({
    type: 'initial',
  });

  const useTransactionParams =
    profile.type === 'resolved' ? paramsForUseTransaction(profile.data) : {};

  const transactionResult = useTransactionAsSpans({
    projectIds,
    enabled: profile.type === 'resolved',
    ...useTransactionParams,
  });

  return (
    <TransactionProfileProvider
      orgSlug={organization.slug}
      profileId={params.eventId!}
      projectSlug={projectSlug}
      profile={profile}
      setProfile={setProfile}
    >
      <ProfileTransactionContext value={transactionResult}>
        <LayoutPageWithHiddenFooter flex={1}>
          <ProfileHeader
            eventId={params.eventId!}
            projectId={projectSlug}
            transactionSpan={transactionResult.data.transactionSpan}
          />
          <Outlet />
        </LayoutPageWithHiddenFooter>
      </ProfileTransactionContext>
    </TransactionProfileProvider>
  );
}

function paramsForUseTransaction(input: Profiling.ProfileInput) {
  if (isSchema(input)) {
    return {
      transactionEventId: input.metadata.transactionID || undefined,
      traceId: input.metadata.traceID || undefined,
      ...getProfileSchemaStartEnd(input),
    };
  }
  if (isSentrySampledProfile(input)) {
    return {
      transactionEventId: input.transaction.id || undefined,
      traceId: input.transaction.trace_id || undefined,
      ...getSampledProfileStartEnd(input),
    };
  }
  return {};
}

function getSampledProfileStartEnd(input: Profiling.SentrySampledProfile): {
  end?: number;
  start?: number;
} {
  const baseTimestamp = new Date(input.timestamp).getTime() / 1000;
  const {samples} = input.profile;
  if (samples.length === 0) {
    return {};
  }
  const startNs = samples[0]!.elapsed_since_start_ns;
  const endNs = samples[samples.length - 1]!.elapsed_since_start_ns;
  return {
    start: baseTimestamp + startNs * 1e-9,
    end: baseTimestamp + endNs * 1e-9,
  };
}

function getProfileSchemaStartEnd(input: Profiling.Schema): {
  end?: number;
  start?: number;
} {
  if (!input.metadata.timestamp) {
    return {};
  }
  const baseTimestamp = new Date(input.metadata.timestamp).getTime() / 1000;
  let maxDurationSec = 0;
  for (const profile of input.profiles) {
    if (isEventedProfile(profile) || isSampledProfile(profile)) {
      const duration = unitToSeconds(profile.endValue - profile.startValue, profile.unit);
      maxDurationSec = Math.max(maxDurationSec, duration);
    } else if (isJSProfile(profile)) {
      if (profile.samples.length > 0) {
        const first = profile.samples[0]!.timestamp;
        const last = profile.samples[profile.samples.length - 1]!.timestamp;
        // JS self-profile timestamps are in milliseconds
        maxDurationSec = Math.max(maxDurationSec, (last - first) / 1000);
      }
    }
  }
  return {start: baseTimestamp, end: baseTimestamp + maxDurationSec};
}

function unitToSeconds(value: number, unit: string): number {
  switch (unit) {
    case 'nanoseconds':
      return value * 1e-9;
    case 'microseconds':
      return value * 1e-6;
    case 'milliseconds':
      return value * 1e-3;
    case 'seconds':
      return value;
    default:
      return value;
  }
}
