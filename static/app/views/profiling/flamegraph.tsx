import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Breadcrumb} from 'sentry/components/profiling/breadcrumb';
import {Flamegraph} from 'sentry/components/profiling/flamegraph';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {importProfile, ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';
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

  const [requestState, setRequestState] = useState<RequestState<ProfileGroup>>({
    type: 'initial',
  });

  useEffect(() => {
    if (!props.params.eventId || !props.params.projectId) {
      return undefined;
    }

    setRequestState({type: 'loading'});

    fetchFlamegraphs(api, props.params.eventId, props.params.projectId, organization)
      .then(importedFlamegraphs => {
        setRequestState({type: 'resolved', data: importedFlamegraphs});
      })
      .catch(err => {
        const message = err.toString() || t('Error: Unable to load profiles');
        setRequestState({type: 'errored', error: message});
        Sentry.captureException(err);
      });

    return () => {
      api.clear();
    };
  }, [props.params.eventId, props.params.projectId, api, organization]);

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumb
              location={props.location}
              organization={organization}
              trails={[
                {type: 'profiling'},
                {
                  type: 'flamegraph',
                  payload: {
                    interactionName:
                      requestState.type === 'resolved' ? requestState.data.name : '',
                    profileId: props.params.eventId ?? '',
                    projectSlug: props.params.projectId ?? '',
                  },
                },
              ]}
            />
          </Layout.HeaderContent>
        </Layout.Header>
        <FlamegraphStateProvider>
          <FlamegraphThemeProvider>
            <FlamegraphContainer>
              {requestState.type === 'errored' ? (
                <Alert type="error" showIcon>
                  {requestState.error}
                </Alert>
              ) : requestState.type === 'loading' ? (
                <Fragment>
                  <Flamegraph profiles={LoadingGroup} />
                  <LoadingIndicatorContainer>
                    <LoadingIndicator />
                  </LoadingIndicatorContainer>
                </Fragment>
              ) : requestState.type === 'resolved' ? (
                <Flamegraph profiles={requestState.data} />
              ) : null}
            </FlamegraphContainer>
          </FlamegraphThemeProvider>
        </FlamegraphStateProvider>
      </Fragment>
    </SentryDocumentTitle>
  );
}

const LoadingIndicatorContainer = styled('div')`
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
`;

const FlamegraphContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;

  /*
   * The footer component is a sibling of this div.
   * Remove it so the flamegraph can take up the
   * entire screen.
   */
  ~ footer {
    display: none;
  }
`;

export default FlamegraphView;
