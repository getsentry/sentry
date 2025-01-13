import {createContext, useContext, useLayoutEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';

import type {Client} from 'sentry/api';
import {ContinuousProfileHeader} from 'sentry/components/profiling/continuousProfileHeader';
import type {RequestState} from 'sentry/types/core';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useSentryEvent} from 'sentry/utils/profiling/hooks/useSentryEvent';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';

interface ContinuousProfileQueryParams {
  end: string;
  profiler_id: string;
  start: string;
}

function fetchContinuousProfileFlamegraph(
  api: Client,
  query: ContinuousProfileQueryParams,
  projectSlug: Project['slug'],
  orgSlug: Organization['slug']
): Promise<Profiling.ProfileInput> {
  return api
    .requestPromise(`/organizations/${orgSlug}/profiling/chunks/`, {
      method: 'GET',
      query: {
        ...query,
        project: projectSlug,
      },
      includeAllArgs: true,
    })
    .then(([data]) => data.chunk);
}

type ContinuousProfileProviderValue = RequestState<Profiling.ProfileInput>;
export const ContinuousProfileContext =
  createContext<ContinuousProfileProviderValue | null>(null);

export function useContinuousProfile() {
  const context = useContext(ContinuousProfileContext);
  if (!context) {
    throw new Error('useContinuousProfile was called outside of ProfileProvider');
  }
  return context;
}

type ContinuousProfileSegmentProviderValue = RequestState<EventTransaction>;
export const ContinuousProfileSegmentContext =
  createContext<ContinuousProfileSegmentProviderValue | null>(null);

export function useContinuousProfileSegment() {
  const context = useContext(ContinuousProfileSegmentContext);
  if (!context) {
    throw new Error(
      'useContinuousProfileSegment was called outside of ContinuousProfileSegmentProvider'
    );
  }
  return context;
}

function isValidDate(date: string): boolean {
  return !isNaN(Date.parse(date));
}

interface FlamegraphViewProps {
  children: React.ReactNode;
}

function ProfilesAndTransactionProvider(props: FlamegraphViewProps): React.ReactElement {
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

  const profileTransaction = useSentryEvent<EventTransaction>(
    organization.slug,
    projectSlug!,
    decodeScalar(location.query.eventId) || null
  );

  return (
    <ProfilesProvider
      orgSlug={organization.slug}
      profileMeta={profileMeta}
      projectSlug={projectSlug}
    >
      <ContinuousProfileSegmentContext.Provider value={profileTransaction}>
        <ContinuousProfileHeader
          projectId={projectSlug}
          transaction={
            profileTransaction.type === 'resolved' ? profileTransaction.data : null
          }
        />
        {props.children}
      </ContinuousProfileSegmentContext.Provider>
    </ProfilesProvider>
  );
}

interface ProfilesProviderProps {
  children: React.ReactNode;
  orgSlug: Organization['slug'];
  profileMeta: ContinuousProfileQueryParams | null;
  projectSlug: Project['slug'];
  onUpdateProfiles?: (profiles: RequestState<Profiling.ProfileInput>) => void;
}

export function ProfilesProvider({
  children,
  onUpdateProfiles,
  orgSlug,
  profileMeta,
  projectSlug,
}: ProfilesProviderProps) {
  const api = useApi();
  const {projects} = useProjects();

  const [profiles, setProfiles] = useState<RequestState<Profiling.ProfileInput>>({
    type: 'initial',
  });

  useLayoutEffect(() => {
    if (!profileMeta) {
      Sentry.captureMessage(
        'Failed to fetch continuous profile - invalid chunk parameters.'
      );
      return undefined;
    }

    const project = projects.find(p => p.slug === projectSlug);
    if (!project) {
      Sentry.captureMessage('Failed to fetch continuous profile - project not found.');
      return undefined;
    }

    setProfiles({type: 'loading'});

    fetchContinuousProfileFlamegraph(api, profileMeta, project.id, orgSlug)
      .then(p => {
        setProfiles({type: 'resolved', data: p});
        onUpdateProfiles?.({type: 'resolved', data: p});
      })
      .catch(err => {
        setProfiles({type: 'errored', error: 'Failed to fetch profiles'});
        onUpdateProfiles?.({type: 'errored', error: 'Failed to fetch profiles'});
        Sentry.captureException(err);
      });

    return () => api.clear();
  }, [api, onUpdateProfiles, profileMeta, orgSlug, projectSlug, projects]);

  return (
    <ContinuousProfileContext.Provider value={profiles}>
      {children}
    </ContinuousProfileContext.Provider>
  );
}

export default ProfilesAndTransactionProvider;
