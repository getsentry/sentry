import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Alert from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Breadcrumb} from 'sentry/components/profiling/breadcrumb';
import {Flamegraph} from 'sentry/components/profiling/flamegraph';
import {ProfileDragDropImportProps} from 'sentry/components/profiling/profileDragDropImport';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';
import {DeepPartial} from 'sentry/types/utils';
import {
  decodeFlamegraphStateFromQueryParams,
  FlamegraphState,
  FlamegraphStateProvider,
  FlamegraphStateQueryParamSync,
} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import useOrganization from 'sentry/utils/useOrganization';

import {useProfileGroup} from './profileGroupProvider';

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
    projectId?: Project['slug'];
  };
}

function FlamegraphView(props: FlamegraphViewProps): React.ReactElement {
  const organization = useOrganization();

  const [profileGroup, setProfileGroup] = useProfileGroup();

  const initialFlamegraphPreferencesState = useMemo((): DeepPartial<FlamegraphState> => {
    return decodeFlamegraphStateFromQueryParams(props.location.query);
    // We only want to decode this when our component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onImport: ProfileDragDropImportProps['onImport'] = profiles => {
    setProfileGroup({type: 'resolved', data: profiles});
  };

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <FlamegraphStateProvider initialState={initialFlamegraphPreferencesState}>
        <FlamegraphStateQueryParamSync />
        <Fragment>
          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumb
                location={props.location}
                organization={organization}
                trails={[
                  {type: 'landing'},
                  {
                    type: 'flamegraph',
                    payload: {
                      transaction:
                        profileGroup.type === 'resolved' ? profileGroup.data.name : '',
                      profileId: props.params.eventId ?? '',
                      projectSlug: props.params.projectId ?? '',
                    },
                  },
                ]}
              />
            </Layout.HeaderContent>
          </Layout.Header>
          <FlamegraphThemeProvider>
            <FlamegraphContainer>
              {profileGroup.type === 'errored' ? (
                <Alert type="error" showIcon>
                  {profileGroup.error}
                </Alert>
              ) : profileGroup.type === 'loading' ? (
                <Fragment>
                  <Flamegraph onImport={onImport} profiles={LoadingGroup} />
                  <LoadingIndicatorContainer>
                    <LoadingIndicator />
                  </LoadingIndicatorContainer>
                </Fragment>
              ) : profileGroup.type === 'resolved' ? (
                <Flamegraph onImport={onImport} profiles={profileGroup.data} />
              ) : null}
            </FlamegraphContainer>
          </FlamegraphThemeProvider>
        </Fragment>
      </FlamegraphStateProvider>
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
