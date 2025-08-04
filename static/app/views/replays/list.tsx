import {Fragment} from 'react';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {Grid} from 'sentry/components/core/layout';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import useOrganization from 'sentry/utils/useOrganization';
import ListContent from 'sentry/views/replays/list/listContent';
import ReplayTabs from 'sentry/views/replays/tabs';

const ReplayListPageHeaderHook = HookOrDefault({
  hookName: 'component:replay-list-page-header',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

export default function ReplaysListContainer() {
  useReplayPageview('replay.list-time-spent');
  const organization = useOrganization();

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
                <ListContent />
              </Grid>
            </Layout.Main>
          </Layout.Body>
        </PageFiltersContainer>
      </SentryDocumentTitle>
    </AnalyticsArea>
  );
}
