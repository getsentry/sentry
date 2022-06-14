import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Flamegraph} from 'sentry/components/profiling/flamegraph';
import {ProfileDragDropImportProps} from 'sentry/components/profiling/profileDragDropImport';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {DeepPartial} from 'sentry/types/utils';
import {
  decodeFlamegraphStateFromQueryParams,
  FlamegraphState,
  FlamegraphStateProvider,
  FlamegraphStateQueryParamSync,
} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/index';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {useProfileGroup} from './profileGroupProvider';

const LoadingGroup: ProfileGroup = {
  name: 'Loading',
  traceID: '',
  activeProfileIndex: 0,
  profiles: [Profile.Empty()],
};

function ProfileFlamegraph(): React.ReactElement {
  const location = useLocation();
  const organization = useOrganization();
  const [profileGroup, setProfileGroup] = useProfileGroup();

  const onImport: ProfileDragDropImportProps['onImport'] = profiles => {
    setProfileGroup({type: 'resolved', data: profiles});
  };

  const initialFlamegraphPreferencesState = useMemo((): DeepPartial<FlamegraphState> => {
    return decodeFlamegraphStateFromQueryParams(location.query);
    // We only want to decode this when our component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Profiling \u2014 Flamegraph')}
        orgSlug={organization.slug}
      >
        <FlamegraphStateProvider initialState={initialFlamegraphPreferencesState}>
          <FlamegraphThemeProvider>
            <FlamegraphStateQueryParamSync />
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
        </FlamegraphStateProvider>
      </SentryDocumentTitle>
    </Fragment>
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

export default ProfileFlamegraph;
