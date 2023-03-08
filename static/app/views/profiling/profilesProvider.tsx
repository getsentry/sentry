import {createContext, useContext, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {ProfileHeader} from 'sentry/components/profiling/profileHeader';
import {t} from 'sentry/locale';
import type {EventTransaction, Organization, Project} from 'sentry/types';
import {RequestState} from 'sentry/types/core';
import {useSentryEvent} from 'sentry/utils/profiling/hooks/useSentryEvent';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {isSchema} from '../../utils/profiling/guards/profile';

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

function getTransactionId(input: Profiling.ProfileInput): string | null {
  if (isSchema(input)) {
    return input.metadata.transactionID;
  }
  return null;
}

interface FlamegraphViewProps {
  children: React.ReactNode;
}

type ProfileProviderValue = RequestState<Profiling.ProfileInput>;
type SetProfileProviderValue = React.Dispatch<
  React.SetStateAction<RequestState<Profiling.ProfileInput>>
>;
export const ProfileContext = createContext<ProfileProviderValue | null>(null);
const SetProfileProvider = createContext<SetProfileProviderValue | null>(null);

export function useProfiles() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfiles was called outside of ProfileProvider');
  }
  return context;
}

export function useSetProfiles() {
  const context = useContext(SetProfileProvider);
  if (!context) {
    throw new Error('useSetProfiles was called outside of SetProfileProvider');
  }
  return context;
}

const ProfileTransactionContext =
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

function ProfileProviderWrapper(props: FlamegraphViewProps): React.ReactElement {
  const organization = useOrganization();
  const params = useParams();

  const [profiles, setProfiles] = useState<RequestState<Profiling.ProfileInput>>({
    type: 'initial',
  });

  const profileTransaction = useSentryEvent<EventTransaction>(
    organization.slug,
    params.projectId,
    profiles.type === 'resolved' ? getTransactionId(profiles.data) : null
  );

  return (
    <ProfilesProvider
      onUpdateProfiles={setProfiles}
      orgSlug={organization.slug}
      profileId={params.eventId}
      projectSlug={params.projectId}
    >
      <SetProfileProvider.Provider value={setProfiles}>
        <ProfileTransactionContext.Provider value={profileTransaction}>
          <ProfileHeader
            eventId={params.eventId}
            projectId={params.projectId}
            transaction={
              profileTransaction.type === 'resolved' ? profileTransaction.data : null
            }
          />
          {props.children}
        </ProfileTransactionContext.Provider>
      </SetProfileProvider.Provider>
    </ProfilesProvider>
  );
}

interface ProfilesProviderProps {
  children: React.ReactNode;
  orgSlug: Organization['slug'];
  profileId: string;
  projectSlug: Project['slug'];
  onUpdateProfiles?: (any) => void;
}

export function ProfilesProvider({
  children,
  onUpdateProfiles,
  orgSlug,
  projectSlug,
  profileId,
}: ProfilesProviderProps) {
  const api = useApi();

  const [profiles, setProfiles] = useState<RequestState<Profiling.ProfileInput>>({
    type: 'initial',
  });

  useEffect(() => {
    if (!profileId || !projectSlug || !orgSlug) {
      return undefined;
    }

    setProfiles({type: 'loading'});

    fetchFlamegraphs(api, profileId, projectSlug, orgSlug)
      .then(p => {
        setProfiles({type: 'resolved', data: p});
        onUpdateProfiles?.({type: 'resolved', data: p});
      })
      .catch(err => {
        const message = err.toString() || t('Error: Unable to load profiles');
        setProfiles({type: 'errored', error: message});
        onUpdateProfiles?.({type: 'errored', error: message});
        Sentry.captureException(err);
      });

    return () => {
      api.clear();
    };
  }, [api, onUpdateProfiles, orgSlug, projectSlug, profileId]);

  return <ProfileContext.Provider value={profiles}>{children}</ProfileContext.Provider>;
}

export default ProfileProviderWrapper;
