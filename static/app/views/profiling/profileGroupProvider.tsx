import React, {createContext, useContext, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';
import {importProfile, ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type InitialState = {type: 'initial'};
type LoadingState = {type: 'loading'};

type ResolvedState<T> = {
  data: T;
  type: 'resolved';
};

type ErroredState = {
  error: string;
  type: 'errored';
};

type RequestState<T> = InitialState | LoadingState | ResolvedState<T> | ErroredState;

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
  location: Location;
  params: {
    eventId?: Trace['id'];
    projectId?: Project['id'];
  };
}

const ProfileGroupContext = createContext<
  | [
      RequestState<ProfileGroup>,
      React.Dispatch<React.SetStateAction<RequestState<ProfileGroup>>>
    ]
  | null
>(null);

export const useProfileGroup = () => {
  const context = useContext(ProfileGroupContext);
  if (!context) {
    throw new Error('useProfileGroup was called outside of ProfileGroupProvider');
  }
  return context;
};

function ProfileGroupProvider(props: FlamegraphViewProps): React.ReactElement {
  const api = useApi();
  const organization = useOrganization();

  const [profileGroupState, setProfileGroupState] = useState<RequestState<ProfileGroup>>({
    type: 'initial',
  });

  useEffect(() => {
    if (!props.params.eventId || !props.params.projectId) {
      return undefined;
    }

    setProfileGroupState({type: 'loading'});

    fetchFlamegraphs(api, props.params.eventId, props.params.projectId, organization)
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
  }, [props.params.eventId, props.params.projectId, api, organization]);

  return (
    <ProfileGroupContext.Provider value={[profileGroupState, setProfileGroupState]}>
      {props.children}
    </ProfileGroupContext.Provider>
  );
}

export default ProfileGroupProvider;
