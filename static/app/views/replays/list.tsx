import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import useOrganization from 'sentry/utils/useOrganization';
import {ReplaysFilters, ReplaysSearch} from 'sentry/views/replays/list/filters';
import ReplaysErroneousDeadRageCards from 'sentry/views/replays/list/replaysErroneousDeadRageCards';
import ReplaysList from 'sentry/views/replays/list/replaysList';

function ReplaysListContainer() {
  useReplayPageview('replay.list-time-spent');
  const {slug: orgSlug} = useOrganization();

  return (
    <SentryDocumentTitle title={`Session Replay — ${orgSlug}`}>
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
              <ReplaysFilters />
              <ReplaysErroneousDeadRageCards />
              <ReplaysSearch />
              <ReplaysList />
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
