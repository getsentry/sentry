import {useMemo, useState} from 'react';

import {ContinuousProfileHeader} from 'sentry/components/profiling/continuousProfileHeader';
import type {RequestState} from 'sentry/types/core';
import type {EventTransaction} from 'sentry/types/event';
import {useSentryEvent} from 'sentry/utils/profiling/hooks/useSentryEvent';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {ContinuousProfileProvider, ProfileTransactionContext} from './profilesProvider';

function isValidDate(date: string): boolean {
  return !isNaN(Date.parse(date));
}

interface FlamegraphViewProps {
  children: React.ReactNode;
}

export default function ProfileAndTransactionProvider(
  props: FlamegraphViewProps
): React.ReactElement {
  const organization = useOrganization();
  const params = useParams();
  const location = useLocation();

  const projectSlug = params.projectId!;

  const profileMeta = useMemo(() => {
    const start = decodeScalar(location.query.start);
    const end = decodeScalar(location.query.end);
    const profilerId = decodeScalar(location.query.profilerId);

    if (!start || !end || !profilerId) {
      return null;
    }

    if (!isValidDate(start) || !isValidDate(end)) {
      return null;
    }

    return {
      start,
      end,
      profiler_id: profilerId,
    };
  }, [location.query.start, location.query.end, location.query.profilerId]);

  const [profile, setProfile] = useState<RequestState<Profiling.ProfileInput>>({
    type: 'initial',
  });

  const profileTransaction = useSentryEvent<EventTransaction>(
    organization.slug,
    projectSlug!,
    decodeScalar(location.query.eventId) || null
  );

  return (
    <ContinuousProfileProvider
      orgSlug={organization.slug}
      profileMeta={profileMeta}
      projectSlug={projectSlug}
      profile={profile}
      setProfile={setProfile}
    >
      <ProfileTransactionContext.Provider value={profileTransaction}>
        <ContinuousProfileHeader
          projectId={projectSlug}
          transaction={
            profileTransaction.type === 'resolved' ? profileTransaction.data : null
          }
        />
        {props.children}
      </ProfileTransactionContext.Provider>
    </ContinuousProfileProvider>
  );
}
