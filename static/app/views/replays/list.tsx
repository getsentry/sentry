import {Fragment} from 'react';
import styled from '@emotion/styled';

import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import useOrganization from 'sentry/utils/useOrganization';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import ReplayOnboardingPanel from 'sentry/views/replays/list/replayOnboardingPanel';
import ReplaysErroneousDeadRageCards from 'sentry/views/replays/list/replaysErroneousDeadRageCards';
import ReplaysList from 'sentry/views/replays/list/replaysList';
import ReplaysSearch from 'sentry/views/replays/list/search';

const ReplayListPageHeaderHook = HookOrDefault({
  hookName: 'component:replay-list-page-header',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

function ReplaysListContainer() {
  useReplayPageview('replay.list-time-spent');
  const organization = useOrganization();

  const hasSessionReplay = false; // organization.features.includes('session-replay');
  const {hasSentOneReplay, fetching} = useHaveSelectedProjectsSentAnyReplayEvents();
  const showOnboarding = !hasSessionReplay || !hasSentOneReplay;

  return (
    <SentryDocumentTitle title={`Session Replay — ${organization.slug}`}>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Session Replay')}
            <PageHeadingQuestionTooltip
              title={t(
                'A view of available video-like reproductions of user sessions so you can visualize repro steps to debug issues faster.'
              )}
              docsUrl="https://docs.sentry.io/product/session-replay/"
            />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <PageFiltersContainer>
        <Layout.Body>
          <Layout.Main fullWidth>
            <LayoutGap>
              <ReplayListPageHeaderHook />
              {fetching ? null : showOnboarding ? (
                <Fragment>
                  <ReplaysFilters>
                    <ReplaysSearch />
                  </ReplaysFilters>
                  <ReplayOnboardingPanel />
                </Fragment>
              ) : (
                <Fragment>
                  <ReplaysFilters />
                  <ReplaysErroneousDeadRageCards />
                  <ReplaysSearch />
                  <ReplaysList />
                </Fragment>
              )}
            </LayoutGap>
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

export default ReplaysListContainer;
