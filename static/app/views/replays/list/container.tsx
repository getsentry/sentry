import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import useOrganization from 'sentry/utils/useOrganization';
import ReplaysList from 'sentry/views/replays/list/replays';

function ReplaysListContainer() {
  useReplayPageview('replay.list-time-spent');
  const {slug: orgSlug} = useOrganization();

  return (
    <SentryDocumentTitle title={`Session Replay - ${orgSlug}`}>
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
            <ReplaysFeatureBadge />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <PageFiltersContainer>
        <ReplaysList />
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default ReplaysListContainer;
