import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Alert from 'sentry/components/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Flamegraph} from 'sentry/components/profiling/flamegraph/flamegraph';
import {ProfileDragDropImportProps} from 'sentry/components/profiling/flamegraph/flamegraphOverlays/profileDragDropImport';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {EntryType} from 'sentry/types';
import {EntrySpans, EventTransaction} from 'sentry/types/event';
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
import {SpanTree} from 'sentry/utils/profiling/spanTree';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

import {
  useProfileGroup,
  useProfileTransaction,
  useSetProfileGroup,
} from './profileGroupProvider';

function collectAllSpanEntriesFromTransaction(
  transaction: EventTransaction
): EntrySpans['data'] {
  if (!transaction.entries.length) {
    return [];
  }

  const spans = transaction.entries.filter(
    (e): e is EntrySpans => e.type === EntryType.SPANS
  );

  let allSpans: EntrySpans['data'] = [];

  for (const span of spans) {
    allSpans = allSpans.concat(span.data);
  }

  return allSpans;
}

const LoadingGroup: ProfileGroup = {
  name: 'Loading',
  activeProfileIndex: 0,
  transactionID: null,
  metadata: {},
  traceID: '',
  profiles: [Profile.Empty],
};

const LoadingSpanTree = SpanTree.Empty();

function ProfileFlamegraph(): React.ReactElement {
  const organization = useOrganization();
  const profileGroup = useProfileGroup();
  const setProfileGroup = useSetProfileGroup();
  const profiledTransaction = useProfileTransaction();

  const hasFlameChartSpans = useMemo(() => {
    return organization.features.includes('organizations:profiling-flamechart-spans');
  }, [organization.features]);

  const spanTree: SpanTree = useMemo(() => {
    if (profiledTransaction.type === 'resolved' && profiledTransaction.data) {
      return new SpanTree(
        profiledTransaction.data,
        collectAllSpanEntriesFromTransaction(profiledTransaction.data)
      );
    }

    return LoadingSpanTree;
  }, [profiledTransaction]);

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

  const onImport: ProfileDragDropImportProps['onImport'] = useCallback(
    profiles => {
      setProfileGroup({type: 'resolved', data: profiles});
    },
    [setProfileGroup]
  );

  const initialFlamegraphPreferencesState = useMemo((): DeepPartial<FlamegraphState> => {
    const queryStringState = decodeFlamegraphStateFromQueryParams(
      qs.parse(window.location.search)
    );

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
                <Flamegraph
                  onImport={onImport}
                  profiles={LoadingGroup}
                  spanTree={hasFlameChartSpans ? LoadingSpanTree : null}
                />
                <LoadingIndicatorContainer>
                  <LoadingIndicator />
                </LoadingIndicatorContainer>
              </Fragment>
            ) : profileGroup.type === 'resolved' ? (
              <Flamegraph
                onImport={onImport}
                profiles={profileGroup.data}
                spanTree={hasFlameChartSpans ? spanTree : null}
              />
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
