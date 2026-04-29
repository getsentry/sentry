import {useMemo, useState} from 'react';
import {Outlet} from 'react-router-dom';

import {ContinuousProfileHeader} from 'sentry/components/profiling/continuousProfileHeader';
import type {RequestState} from 'sentry/types/core';
import {useTransactionAsSpans} from 'sentry/utils/profiling/hooks/useTransactionAsSpans';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {LayoutPageWithHiddenFooter} from 'sentry/views/explore/profiling/layoutPageWithHiddenFooter';

import {ContinuousProfileProvider, ProfileTransactionContext} from './profilesProvider';

function isValidDate(date: string): boolean {
  return !isNaN(Date.parse(date));
}

export default function ProfileAndTransactionProvider(): React.ReactElement {
  const organization = useOrganization();
  const params = useParams();
  const location = useLocation();

  const projectSlug = params.projectId!;
  const {projects} = useProjects({slugs: [projectSlug]});
  const projectIds = useMemo(() => projects.map(p => Number(p.id)), [projects]);

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

  // Legacy event ID for spans extracted from transactions (`transaction.event_id`)
  const eventId = decodeScalar(location.query.eventId) || undefined;
  // New transaction ID for streaming spans (`transaction.span_id`)
  const transactionId = decodeScalar(location.query.transactionId) || undefined;

  const [profile, setProfile] = useState<RequestState<Profiling.ProfileInput>>({
    type: eventId || transactionId ? 'initial' : 'empty',
  });

  const traceId = decodeScalar(location.query.traceId) || undefined;
  const start = profileMeta ? Date.parse(profileMeta.start) / 1000 : undefined;
  const end = profileMeta ? Date.parse(profileMeta.end) / 1000 : undefined;
  const transactionResult = useTransactionAsSpans({
    transactionEventId: eventId,
    transactionSpanId: transactionId,
    traceId,
    start,
    end,
    projectIds,
    enabled: profile.type === 'resolved',
  });

  return (
    <ContinuousProfileProvider
      orgSlug={organization.slug}
      profileMeta={profileMeta}
      projectSlug={projectSlug}
      profile={profile}
      setProfile={setProfile}
    >
      <ProfileTransactionContext value={transactionResult}>
        <LayoutPageWithHiddenFooter flex={1}>
          <ContinuousProfileHeader
            transactionSpan={transactionResult.data.transactionSpan}
          />
          <Outlet />
        </LayoutPageWithHiddenFooter>
      </ProfileTransactionContext>
    </ContinuousProfileProvider>
  );
}
