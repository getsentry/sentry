import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import * as Layout from 'sentry/components/layouts/thirds';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {LocalStorageReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {
  ReplayAccess,
  ReplayAccessFallbackAlert,
} from 'sentry/components/replays/replayAccess';
import {useReplayTableSort} from 'sentry/components/replays/table/useReplayTableSort';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
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
import {useQueryParamsSearch} from 'sentry/views/explore/queryParams/context';
import {useAllMobileProj} from 'sentry/views/explore/replays/detail/useAllMobileProj';
import {ReplayIndexContainer} from 'sentry/views/explore/replays/list/replayIndexContainer';
import {ReplayListControls} from 'sentry/views/explore/replays/list/replayListControls';
import {ReplayOnboardingPanel} from 'sentry/views/explore/replays/list/replayOnboardingPanel';
import {ReplayQueryParamsProvider} from 'sentry/views/explore/replays/list/replayQueryParamsProvider';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

const ReplayListPageHeaderHook = OverrideOrDefault({
  overrideName: 'component:replay-list-page-header',
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

function useReplayListLLMContextData({
  showDeadRageClickCards,
  widgetIsOpen,
}: {
  showDeadRageClickCards: boolean;
  widgetIsOpen: boolean;
}) {
  const searchQuery = useQueryParamsSearch().formatString();
  const pageFilters = usePageFilters();
  const {sortType} = useReplayTableSort();
  useLLMContext({
    contextHint:
      'Sentry session replay list page. Users search and filter recorded browser sessions by attributes like error count, rage clicks, dead clicks, browser, OS, and user. You can search events with a replays filter to find sessions matching specific criteria, or look up an individual replay by its ID for full session details.',
    searchQuery,
    sort: `${sortType.kind === 'desc' ? '-' : ''}${sortType.field}`,
    currentSelectedDateRange: pageFilters.selection.datetime,
    deadRageClickWidgetsVisible: showDeadRageClickCards && widgetIsOpen,
  });
}

function ReplaysListBody() {
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

  useReplayListLLMContextData({showDeadRageClickCards, widgetIsOpen});

  useRouteAnalyticsParams({
    hasSessionReplay,
    hasSentReplays: hasSentReplays.hasSentOneReplay,
    hasRageClickMinSDK: !rageClicksSdkVersion.needsUpdate,
  });

  return (
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
  );
}

function ReplaysListContainer() {
  const organization = useOrganization();

  return (
    <AnalyticsArea name="list">
      <SentryDocumentTitle title="Session Replay" orgSlug={organization.slug}>
        <ReplayPreferencesContextProvider prefsStrategy={LocalStorageReplayPreferences}>
          <ReplayQueryParamsProvider>
            <ReplaysListBody />
          </ReplayQueryParamsProvider>
        </ReplayPreferencesContextProvider>
      </SentryDocumentTitle>
    </AnalyticsArea>
  );
}

export default registerLLMContext('replays-list', ReplaysListContainer);
