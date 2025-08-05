import {Fragment} from 'react';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {Grid} from 'sentry/components/core/layout';
import {Flex} from 'sentry/components/core/layout/flex';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import {MIN_DEAD_RAGE_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import ReplayIndexTable from 'sentry/views/replays/list/replayIndexTable';
import ReplayOnboardingPanel from 'sentry/views/replays/list/replayOnboardingPanel';
import ReplaysSearch from 'sentry/views/replays/list/search';
import ReplayTabs from 'sentry/views/replays/tabs';

const ReplayListPageHeaderHook = HookOrDefault({
  hookName: 'component:replay-list-page-header',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

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
    organization,
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
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>
              {t('Session Replay')}
              <PageHeadingQuestionTooltip
                title={t(
                  'Video-like reproductions of user sessions so you can visualize repro steps to debug issues faster.'
                )}
                docsUrl="https://docs.sentry.io/product/session-replay/"
              />
            </Layout.Title>
          </Layout.HeaderContent>
          <ReplayTabs selected="replays" />
        </Layout.Header>
        <PageFiltersContainer>
          <Layout.Body>
            <Layout.Main fullWidth>
              <Grid gap="xl">
                <ReplayListPageHeaderHook />
                {hasSessionReplay && hasSentReplays.hasSentOneReplay ? (
                  <ReplayIndexTable />
                ) : (
                  <Fragment>
                    <Flex gap="xl" wrap="wrap">
                      <ReplaysFilters />
                      <ReplaysSearch />
                    </Flex>
                    <ReplayOnboardingPanel />
                  </Fragment>
                )}
              </Grid>
            </Layout.Main>
          </Layout.Body>
        </PageFiltersContainer>
      </SentryDocumentTitle>
    </AnalyticsArea>
  );
}
