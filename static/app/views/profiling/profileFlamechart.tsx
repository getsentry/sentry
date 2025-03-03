import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Flamegraph} from 'sentry/components/profiling/flamegraph/flamegraph';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {DeepPartial} from 'sentry/types/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {FlamegraphState} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContext';
import {DEFAULT_FLAMEGRAPH_STATE} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContext';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {
  decodeFlamegraphStateFromQueryParams,
  FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY,
  FlamegraphStateLocalStorageSync,
  FlamegraphStateQueryParamSync,
} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphQueryParamSync';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';

import {useProfiles, useProfileTransaction} from './profilesProvider';

function ProfileFlamegraph(): React.ReactElement {
  const organization = useOrganization();
  const profiles = useProfiles();
  const profiledTransaction = useProfileTransaction();
  const params = useParams();

  const [storedPreferences] = useLocalStorageState<DeepPartial<FlamegraphState>>(
    FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY,
    {
      preferences: {
        layout: DEFAULT_FLAMEGRAPH_STATE.preferences.layout,
        view: DEFAULT_FLAMEGRAPH_STATE.preferences.view,
        colorCoding: DEFAULT_FLAMEGRAPH_STATE.preferences.colorCoding,
        sorting: DEFAULT_FLAMEGRAPH_STATE.preferences.sorting,
      },
    }
  );

  const currentProject = useCurrentProjectFromRouteParam();

  useEffect(() => {
    trackAnalytics('profiling_views.profile_flamegraph', {
      organization,
      project_platform: currentProject?.platform,
      project_id: currentProject?.id,
    });
    // ignore  currentProject so we don't block the analytics event
    // or fire more than once unnecessarily
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization]);

  const initialFlamegraphPreferencesState = useMemo((): DeepPartial<FlamegraphState> => {
    const queryStringState = decodeFlamegraphStateFromQueryParams(
      qs.parse(window.location.search)
    );

    return {
      ...queryStringState,
      preferences: {
        ...storedPreferences.preferences,
        ...queryStringState.preferences,
        timelines: {
          ...DEFAULT_FLAMEGRAPH_STATE.preferences.timelines,
          ...(storedPreferences?.preferences?.timelines ?? {}),
        },
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
        <ProfileGroupTypeProvider
          input={profiles.type === 'resolved' ? profiles.data : null}
          traceID={params.eventId!}
        >
          <FlamegraphThemeProvider>
            <FlamegraphStateQueryParamSync />
            <FlamegraphStateLocalStorageSync />
            <FlamegraphContainer>
              {profiles.type === 'loading' || profiledTransaction.type === 'loading' ? (
                <LoadingIndicatorContainer>
                  <LoadingIndicator />
                </LoadingIndicatorContainer>
              ) : null}
              <Flamegraph />
            </FlamegraphContainer>
          </FlamegraphThemeProvider>
        </ProfileGroupTypeProvider>
      </FlamegraphStateProvider>
    </SentryDocumentTitle>
  );
}

// This only exists because we need to call useFlamegraphPreferences
// to get the type of visualization that the user is looking at and
// we cannot do it in the component above as it is not a child of the
// FlamegraphStateProvider.
function ProfileGroupTypeProvider({
  children,
  input,
  traceID,
}: {
  children: React.ReactNode;
  input: Profiling.ProfileInput | null;
  traceID: string;
}) {
  const preferences = useFlamegraphPreferences();
  return (
    <ProfileGroupProvider
      input={input}
      traceID={traceID}
      type={preferences.sorting === 'call order' ? 'flamechart' : 'flamegraph'}
    >
      {children}
    </ProfileGroupProvider>
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
