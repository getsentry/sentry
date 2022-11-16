import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Flamegraph} from 'sentry/components/profiling/flamegraph/flamegraph';
import {ProfileDragDropImportProps} from 'sentry/components/profiling/flamegraph/flamegraphOverlays/profileDragDropImport';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {DeepPartial} from 'sentry/types/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {
  DEFAULT_FLAMEGRAPH_STATE,
  FlamegraphState,
} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContext';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {
  decodeFlamegraphStateFromQueryParams,
  FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY,
  FlamegraphStateLocalStorageSync,
  FlamegraphStateQueryParamSync,
} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphQueryParamSync';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {useProfileGroup} from './profileGroupProvider';

const LoadingGroup: ProfileGroup = {
  name: 'Loading',
  activeProfileIndex: 0,
  transactionID: null,
  metadata: {},
  traceID: '',
  profiles: [Profile.Empty],
};

function ProfileFlamegraph(): React.ReactElement {
  const location = useLocation();
  const organization = useOrganization();
  const [profileGroup, setProfileGroup] = useProfileGroup();

  const [storedPreferences] = useLocalStorageState<DeepPartial<FlamegraphState>>(
    FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY,
    {
      preferences: {layout: DEFAULT_FLAMEGRAPH_STATE.preferences.layout},
    }
  );

  useEffect(() => {
    trackAdvancedAnalyticsEvent('profiling_views.profile_flamegraph', {
      organization,
    });
  }, [organization]);

  const onImport: ProfileDragDropImportProps['onImport'] = profiles => {
    setProfileGroup({type: 'resolved', data: profiles});
  };

  const initialFlamegraphPreferencesState = useMemo((): DeepPartial<FlamegraphState> => {
    const queryStringState = decodeFlamegraphStateFromQueryParams(location.query);

    return {
      ...queryStringState,
      preferences: {
        ...storedPreferences.preferences,
        ...queryStringState.preferences,
        layout:
          storedPreferences?.preferences?.layout ??
          queryStringState.preferences?.layout ??
          DEFAULT_FLAMEGRAPH_STATE.preferences.layout,
      },
    };
    // We only want to decode this when our component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SentryDocumentTitle
      title={t('Profiling \u2014 Flamechart')}
      orgSlug={organization.slug}
    >
      <FlamegraphStateProvider initialState={initialFlamegraphPreferencesState}>
        <FlamegraphThemeProvider>
          <FlamegraphStateQueryParamSync />
          <FlamegraphStateLocalStorageSync />
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
