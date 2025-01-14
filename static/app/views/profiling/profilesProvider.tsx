import {createContext, useContext, useLayoutEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {RequestState} from 'sentry/types/core';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import useProjects from 'sentry/utils/useProjects';

function fetchFlamegraphs(
  api: Client,
  eventId: string,
  projectSlug: Project['slug'],
  orgSlug: Organization['slug']
): Promise<Profiling.ProfileInput> {
  return api
    .requestPromise(
      `/projects/${orgSlug}/${projectSlug}/profiling/profiles/${eventId}/`,
      {
        method: 'GET',
        includeAllArgs: true,
      }
    )
    .then(([data]) => data);
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

type ProfileProviderValue = RequestState<Profiling.ProfileInput>;
export const ProfileContext = createContext<ProfileProviderValue | null>(null);

export function useProfiles() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfiles was called outside of ProfileProvider');
  }
  return context;
}

export const ProfileTransactionContext =
  createContext<RequestState<EventTransaction | null> | null>(null);

export function useProfileTransaction() {
  const context = useContext(ProfileTransactionContext);
  if (!context) {
    throw new Error(
      'useProfileTransaction was called outside of ProfileTransactionContext'
    );
  }
  return context;
}

interface ProfilesProviderProps {
  children: React.ReactNode;
  orgSlug: Organization['slug'];
  profileMeta: string | ContinuousProfileQueryParams;
  projectSlug: Project['slug'];
}

export function ProfilesProvider({
  children,
  orgSlug,
  profileMeta,
  projectSlug,
}: ProfilesProviderProps) {
  const [profile, setProfile] = useState<RequestState<Profiling.ProfileInput>>({
    type: 'initial',
  });

  if (isContinuousProfileQueryParams(profileMeta)) {
    return (
      <ContinuousProfileProvider
        orgSlug={orgSlug}
        projectSlug={projectSlug}
        profileMeta={profileMeta}
        profile={profile}
        setProfile={setProfile}
      >
        {children}
      </ContinuousProfileProvider>
    );
  }

  return (
    <TransactionProfileProvider
      orgSlug={orgSlug}
      projectSlug={projectSlug}
      profileId={profileMeta}
      profile={profile}
      setProfile={setProfile}
    >
      {children}
    </TransactionProfileProvider>
  );
}

interface TransactionProfileProviderProps {
  children: React.ReactNode;
  orgSlug: Organization['slug'];
  profile: RequestState<Profiling.ProfileInput>;
  profileId: string;
  projectSlug: Project['slug'];
  setProfile: (profiles: RequestState<Profiling.ProfileInput>) => void;
}

export function TransactionProfileProvider({
  children,
  orgSlug,
  profile,
  projectSlug,
  profileId,
  setProfile,
}: TransactionProfileProviderProps) {
  const api = useApi();

  useLayoutEffect(() => {
    if (!profileId || !projectSlug || !orgSlug) {
      return undefined;
    }

    setProfile({type: 'loading'});

    fetchFlamegraphs(api, profileId, projectSlug, orgSlug)
      .then(p => {
        setProfile({type: 'resolved', data: p});
      })
      .catch(err => {
        // XXX: our API client mock implementation does not mimick the real
        // implementation, so we need to check for an empty object here. #sad
        const isEmptyObject = err.toString() === '[object Object]';
        const message = isEmptyObject
          ? t('Error: Unable to load profiles')
          : err.toString();

        setProfile({type: 'errored', error: message});
        Sentry.captureException(err);
      });

    return () => {
      api.clear();
    };
  }, [api, orgSlug, projectSlug, profileId, setProfile]);

  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}

export interface ContinuousProfileQueryParams {
  end: string;
  profiler_id: string;
  start: string;
}

function isContinuousProfileQueryParams(val: any): val is ContinuousProfileQueryParams {
  return (
    typeof val === 'object' &&
    typeof val.start === 'string' &&
    typeof val.end === 'string' &&
    typeof val.profiler_id === 'string'
  );
}

interface ContinuousProfileProviderProps {
  children: React.ReactNode;
  orgSlug: Organization['slug'];
  profile: RequestState<Profiling.ProfileInput>;
  profileMeta: ContinuousProfileQueryParams | null;
  projectSlug: Project['slug'];
  setProfile: (profile: RequestState<Profiling.ProfileInput>) => void;
}

export function ContinuousProfileProvider({
  children,
  orgSlug,
  profile,
  profileMeta,
  projectSlug,
  setProfile,
}: ContinuousProfileProviderProps) {
  const api = useApi();
  const {projects} = useProjects();

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

    setProfile({type: 'loading'});

    fetchContinuousProfileFlamegraph(api, profileMeta, project.id, orgSlug)
      .then(p => {
        setProfile({type: 'resolved', data: p});
      })
      .catch(err => {
        setProfile({type: 'errored', error: 'Failed to fetch profiles'});
        Sentry.captureException(err);
      });

    return () => api.clear();
  }, [api, profileMeta, orgSlug, projectSlug, projects, setProfile]);

  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}
