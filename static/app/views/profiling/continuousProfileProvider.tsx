import {useMemo, useState} from 'react';
import {Outlet} from 'react-router-dom';

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

export default function ProfileAndTransactionProvider(): React.ReactElement {
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

  const eventId = decodeScalar(location.query.eventId) || null;

  const [profile, setProfile] = useState<RequestState<Profiling.ProfileInput>>({
    type: eventId ? 'initial' : 'empty',
  });

  const profileTransaction = useSentryEvent<EventTransaction>(
    organization.slug,
    projectSlug,
    eventId,
    !eventId // disable if no event id
  );

  return (
    <ContinuousProfileProvider
      orgSlug={organization.slug}
      profileMeta={profileMeta}
      projectSlug={projectSlug}
      profile={profile}
      setProfile={setProfile}
    >
      <ProfileTransactionContext value={profileTransaction}>
        <ContinuousProfileHeader
          transaction={
            profileTransaction.type === 'resolved' ? profileTransaction.data : null
          }
        />
        <Outlet />
      </ProfileTransactionContext>
    </ContinuousProfileProvider>
  );
}
