import {createContext, useContext, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {ProfileHeader} from 'sentry/components/profiling/profileHeader';
import {t} from 'sentry/locale';
import type {EventTransaction, Organization, Project} from 'sentry/types';
import {RequestState} from 'sentry/types/core';
import {useSentryEvent} from 'sentry/utils/profiling/hooks/useSentryEvent';
import {importProfile, ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

function fetchFlamegraphs(
  api: Client,
  eventId: string,
  projectId: Project['id'],
  organization: Organization
): Promise<ProfileGroup> {
  return api
    .requestPromise(
      `/projects/${organization.slug}/${projectId}/profiling/profiles/${eventId}/`,
      {
        method: 'GET',
        includeAllArgs: true,
      }
    )
    .then(([data]) => importProfile(data, eventId));
}

interface FlamegraphViewProps {
  children: React.ReactNode;
}

type ProfileGroupContextValue = RequestState<ProfileGroup>;
type SetProfileGroupContextValue = React.Dispatch<
  React.SetStateAction<RequestState<ProfileGroup>>
>;
const ProfileGroupContext = createContext<ProfileGroupContextValue | null>(null);
const SetProfileGroupContext = createContext<SetProfileGroupContextValue | null>(null);

export function useProfileGroup() {
  const context = useContext(ProfileGroupContext);
  if (!context) {
    throw new Error('useProfileGroup was called outside of ProfileGroupProvider');
  }
  return context;
}

export function useSetProfileGroup() {
  const context = useContext(SetProfileGroupContext);
  if (!context) {
    throw new Error('useSetProfileGroup was called outside of SetProfileGroupProvider');
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

function ProfileGroupProvider(props: FlamegraphViewProps): React.ReactElement {
  const api = useApi();
  const organization = useOrganization();
  const params = useParams();

  const [profileGroupState, setProfileGroupState] = useState<RequestState<ProfileGroup>>({
    type: 'initial',
  });

  const profileTransaction = useSentryEvent<EventTransaction>(
    params.orgId,
    params.projectId,
    profileGroupState.type === 'resolved' ? profileGroupState.data.transactionID : null
  );

  useEffect(() => {
    if (!params.eventId || !params.projectId) {
      return undefined;
    }

    setProfileGroupState({type: 'loading'});

    fetchFlamegraphs(api, params.eventId, params.projectId, organization)
      .then(importedFlamegraphs => {
        setProfileGroupState({type: 'resolved', data: importedFlamegraphs});
      })
      .catch(err => {
        const message = err.toString() || t('Error: Unable to load profiles');
        setProfileGroupState({type: 'errored', error: message});
        Sentry.captureException(err);
      });

    return () => {
      api.clear();
    };
  }, [params.eventId, params.projectId, api, organization]);

  return (
    <ProfileGroupContext.Provider value={profileGroupState}>
      <SetProfileGroupContext.Provider value={setProfileGroupState}>
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
      </SetProfileGroupContext.Provider>
    </ProfileGroupContext.Provider>
  );
}

export default ProfileGroupProvider;
