import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {HookOrDefault} from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {LocalStorageReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {
  ReplayAccess,
  ReplayAccessFallbackAlert,
} from 'sentry/components/replays/replayAccess';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {useReplayPageview} from 'sentry/utils/replays/hooks/useReplayPageview';
import {ReplayPreferencesContextProvider} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {MIN_DEAD_RAGE_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectSdkNeedsUpdate} from 'sentry/utils/useProjectSdkNeedsUpdate';
import {ExploreBreadcrumb} from 'sentry/views/explore/components/breadcrumb';
import {
  ExploreBodyContent,
  ExploreBodySearch,
  ExploreContentSection,
} from 'sentry/views/explore/components/styles';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {
  useQueryParamsId,
  useQueryParamsTitle,
} from 'sentry/views/explore/queryParams/context';
import {useAllMobileProj} from 'sentry/views/explore/replays/detail/useAllMobileProj';
import {ReplayIndexContainer} from 'sentry/views/explore/replays/list/replayIndexContainer';
import {ReplayListControls} from 'sentry/views/explore/replays/list/replayListControls';
import {ReplayOnboardingPanel} from 'sentry/views/explore/replays/list/replayOnboardingPanel';
import {ReplayQueryParamsProvider} from 'sentry/views/explore/replays/list/replayQueryParamsProvider';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {TopBar} from 'sentry/views/navigation/topBar';

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

  const titleContent = title ? (
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
  );

  return (
    <Fragment>
      {hasSavedQueryTitle ? (
        <SentryDocumentTitle
          title={`${savedQuery.name} — ${t('Session Replay')}`}
          orgSlug={organization?.slug}
        />
      ) : null}
      <TopBar.Slot name="title">
        {title && defined(pageId) ? (
          <ExploreBreadcrumb
            traceItemDataset={TraceItemDataset.REPLAYS}
            savedQueryName={savedQuery?.name}
          />
        ) : (
          titleContent
        )}
      </TopBar.Slot>
    </Fragment>
  );
}

export default function ReplaysListContainer() {
  useReplayPageview('replay.list-time-spent');
  const organization = useOrganization();
  const hasSentReplays = useHaveSelectedProjectsSentAnyReplayEvents();
  const {allMobileProj} = useAllMobileProj({});

  const hasSessionReplay = organization.features.includes('session-replay');

  const {
    selection: {projects},
  } = usePageFilters();

  const rageClicksSdkVersion = useProjectSdkNeedsUpdate({
    minVersion: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
    projectId: projects.map(String),
  });
  const isLoading = hasSentReplays.fetching || rageClicksSdkVersion.isFetching;
  const showDeadRageClickCards =
    hasSentReplays.hasSentOneReplay &&
    !rageClicksSdkVersion.needsUpdate &&
    !allMobileProj &&
    !isLoading;
  const [widgetIsOpen, setWidgetIsOpen] = useLocalStorageState(
    'replay-dead-rage-widget-open',
    true
  );
  const toggleWidgets = () => setWidgetIsOpen(isOpen => !isOpen);

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
            <Stack flex={1}>
              <ReplaysHeader />
              <PageFiltersContainer>
                <ExploreBodySearch>
                  <Layout.Main width="full">
                    <ReplayListControls
                      onToggleWidgets={toggleWidgets}
                      showDeadRageClickCards={showDeadRageClickCards}
                      widgetIsOpen={widgetIsOpen}
                    />
                  </Layout.Main>
                </ExploreBodySearch>
                <ExploreBodyContent>
                  <ExploreContentSection gap="xl">
                    <ReplayListPageHeaderHook />
                    {hasSessionReplay && hasSentReplays.hasSentOneReplay ? (
                      <ReplayAccess fallback={<ReplayAccessFallbackAlert />}>
                        <ReplayIndexContainer
                          showDeadRageClickCards={showDeadRageClickCards}
                          widgetIsOpen={widgetIsOpen}
                        />
                      </ReplayAccess>
                    ) : (
                      <ReplayOnboardingPanel />
                    )}
                  </ExploreContentSection>
                </ExploreBodyContent>
              </PageFiltersContainer>
            </Stack>
          </ReplayQueryParamsProvider>
        </ReplayPreferencesContextProvider>
      </SentryDocumentTitle>
    </AnalyticsArea>
  );
}
