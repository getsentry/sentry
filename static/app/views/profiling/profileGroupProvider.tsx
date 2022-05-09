import {createContext, useContext, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {FlamegraphHeader} from 'sentry/components/profiling/flamegraphHeader';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {RequestState} from 'sentry/types/core';
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
  const params = useParams();

  const [profileGroupState, setProfileGroupState] = useState<RequestState<ProfileGroup>>({
    type: 'initial',
  });

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
    <ProfileGroupContext.Provider value={[profileGroupState, setProfileGroupState]}>
      <FlamegraphHeader />
      {props.children}
    </ProfileGroupContext.Provider>
  );
}

export default ProfileGroupProvider;
