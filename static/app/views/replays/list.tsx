import {Fragment} from 'react';
import styled from '@emotion/styled';

import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import useOrganization from 'sentry/utils/useOrganization';
import ListContent from 'sentry/views/replays/list/listContent';
import ReplayTabs from 'sentry/views/replays/tabs';

const ReplayListPageHeaderHook = HookOrDefault({
  hookName: 'component:replay-list-page-header',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

function ReplaysListContainer() {
  useReplayPageview('replay.list-time-spent');
  const organization = useOrganization();

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
        <ReplayTabs selected="replays" />
      </Layout.Header>
      <PageFiltersContainer>
        <Layout.Body>
          <Layout.Main fullWidth>
            <LayoutGap>
              <ReplayListPageHeaderHook />
              <ListContent />
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
