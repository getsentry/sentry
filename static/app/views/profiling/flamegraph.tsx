import React, {useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Flamegraph} from 'sentry/components/profiling/flamegraph';
import {FullScreenFlamegraphContainer} from 'sentry/components/profiling/fullScreenFlamegraphContainer';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';
import {FlamegraphPreferencesProvider} from 'sentry/utils/profiling/flamegraph/flamegraphPreferencesProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {importProfile, ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type RequestState = 'initial' | 'loading' | 'resolved' | 'errored';

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

const LoadingGroup: ProfileGroup = {
  name: 'Loading',
  traceID: '',
  activeProfileIndex: 0,
  profiles: [Profile.Empty()],
};

interface FlamegraphViewProps {
  location: Location;
  params: {
    eventId?: Trace['id'];
    projectId?: Project['id'];
  };
}

function FlamegraphView(props: FlamegraphViewProps): React.ReactElement {
  const api = useApi();
  const organization = useOrganization();

  const [profiles, setProfiles] = useState<ProfileGroup | null>(null);
  const [requestState, setRequestState] = useState<RequestState>('initial');

  useEffect(() => {
    document.scrollingElement?.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!props.params.eventId || !props.params.projectId) {
      return;
    }
    api.clear();
    setRequestState('loading');

    fetchFlamegraphs(api, props.params.eventId, props.params.projectId, organization)
      .then(importedFlamegraphs => {
        setProfiles(importedFlamegraphs);
        setRequestState('resolved');
      })
      .catch(() => setRequestState('errored'));
  }, [props.params.eventId, props.params.projectId, api, organization]);

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <FlamegraphPreferencesProvider>
        <FlamegraphThemeProvider>
          <FullScreenFlamegraphContainer>
            {requestState === 'errored' ? (
              <Alert type="error" icon={<IconFlag size="md" />}>
                {t('Unable to load profiles')}
              </Alert>
            ) : requestState === 'loading' ? (
              <React.Fragment>
                <Flamegraph profiles={LoadingGroup} />
                <LoadingIndicator />
              </React.Fragment>
            ) : requestState === 'resolved' && profiles ? (
              <Flamegraph profiles={profiles} />
            ) : null}
          </FullScreenFlamegraphContainer>
        </FlamegraphThemeProvider>
      </FlamegraphPreferencesProvider>
    </SentryDocumentTitle>
  );
}

export default FlamegraphView;
