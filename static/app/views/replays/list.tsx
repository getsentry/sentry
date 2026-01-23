import {Fragment} from 'react';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {Grid} from 'sentry/components/core/layout';
import {Flex} from 'sentry/components/core/layout/flex';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {LocalStorageReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {
  ReplayAccess,
  ReplayAccessFallbackAlert,
} from 'sentry/components/replays/replayAccess';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import {ReplayPreferencesContextProvider} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {MIN_DEAD_RAGE_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import ExploreBreadcrumb from 'sentry/views/explore/components/breadcrumb';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {
  useQueryParamsId,
  useQueryParamsTitle,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import ReplayIndexContainer from 'sentry/views/replays/list/replayIndexContainer';
import ReplayIndexTimestampPrefPicker from 'sentry/views/replays/list/replayIndexTimestampPrefPicker';
import ReplayOnboardingPanel from 'sentry/views/replays/list/replayOnboardingPanel';
import {ReplayQueryParamsProvider} from 'sentry/views/replays/list/replayQueryParamsProvider';
import {SaveReplayQueryButton} from 'sentry/views/replays/list/saveReplayQueryButton';
import ReplaysSearch from 'sentry/views/replays/list/search';

const ReplayListPageHeaderHook = HookOrDefault({
  hookName: 'component:replay-list-page-header',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

function ReplaysHeader() {
  const pageId = useQueryParamsId();
  const title = useQueryParamsTitle();
  const organization = useOrganization();
  const {data: savedQuery} = useGetSavedQuery(pageId);

  const hasSavedQueryTitle =
    defined(pageId) && defined(savedQuery) && savedQuery.name.length > 0;

  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
        {hasSavedQueryTitle ? (
          <SentryDocumentTitle
            title={`${savedQuery.name} — ${t('Session Replay')}`}
            orgSlug={organization?.slug}
          />
        ) : null}
        {title && defined(pageId) ? (
          <ExploreBreadcrumb traceItemDataset={TraceItemDataset.REPLAYS} />
        ) : null}

        <Layout.Title>
          {title ? (
            title
          ) : (
            <Fragment>
              {t('Session Replay')}
              <PageHeadingQuestionTooltip
                title={t(
                  'Video-like reproductions of user sessions so you can visualize repro steps to debug issues faster.'
                )}
                docsUrl="https://docs.sentry.io/product/session-replay/"
              />
            </Fragment>
          )}
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ReplayIndexTimestampPrefPicker />
      </Layout.HeaderActions>
    </Layout.Header>
  );
}

export default function ReplaysListContainer() {
  useReplayPageview('replay.list-time-spent');
  const organization = useOrganization();
  const hasSentReplays = useHaveSelectedProjectsSentAnyReplayEvents();

  const hasSessionReplay = organization.features.includes('session-replay');

  const {
    selection: {projects},
  } = usePageFilters();

  const rageClicksSdkVersion = useProjectSdkNeedsUpdate({
    minVersion: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
    projectId: projects.map(String),
  });

  useRouteAnalyticsParams({
    hasSessionReplay,
    hasSentReplays: hasSentReplays.hasSentOneReplay,
    hasRageClickMinSDK: !rageClicksSdkVersion.needsUpdate,
  });

  return (
    <AnalyticsArea name="list">
      <SentryDocumentTitle title="Session Replay" orgSlug={organization.slug}>
        <ReplayPreferencesContextProvider prefsStrategy={LocalStorageReplayPreferences}>
          <ReplayQueryParamsProvider>
            <ReplaysHeader />
            <PageFiltersContainer>
              <Layout.Body>
                <Layout.Main width="full">
                  <Grid gap="xl" columns="100%">
                    <ReplayListPageHeaderHook />
                    {hasSessionReplay && hasSentReplays.hasSentOneReplay ? (
                      <ReplayAccess fallback={<ReplayAccessFallbackAlert />}>
                        <ReplayIndexContainer />
                      </ReplayAccess>
                    ) : (
                      <Fragment>
                        <Flex gap="xl" wrap="wrap">
                          <ReplaysFilters />
                          <ReplaysSearch />
                          <SaveReplayQueryButton />
                        </Flex>
                        <ReplayOnboardingPanel />
                      </Fragment>
                    )}
                  </Grid>
                </Layout.Main>
              </Layout.Body>
            </PageFiltersContainer>
          </ReplayQueryParamsProvider>
        </ReplayPreferencesContextProvider>
      </SentryDocumentTitle>
    </AnalyticsArea>
  );
}
