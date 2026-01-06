import {Fragment} from 'react';
import styled from '@emotion/styled';
import invariant from 'invariant';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {Flex} from 'sentry/components/core/layout';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import {
  ReplayAccess,
  ReplayAccessFallbackAlert,
} from 'sentry/components/replays/replayAccess';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import ReplayDetailsProviders from 'sentry/views/replays/detail/body/replayDetailsProviders';
import ReplayDetailsHeaderActions from 'sentry/views/replays/detail/header/replayDetailsHeaderActions';
import ReplayDetailsMetadata from 'sentry/views/replays/detail/header/replayDetailsMetadata';
import ReplayDetailsPageBreadcrumbs from 'sentry/views/replays/detail/header/replayDetailsPageBreadcrumbs';
import ReplayDetailsUserBadge from 'sentry/views/replays/detail/header/replayDetailsUserBadge';
import ReplayDetailsPage from 'sentry/views/replays/detail/page';

export default function ReplayDetails() {
  return (
    <AnalyticsArea name="details">
      <ReplayAccess
        fallback={
          <Fragment>
            <TopHeader justify="between" align="center" gap="md">
              {t('Replay Details')}
            </TopHeader>
            <Layout.Body>
              <ReplayAccessFallbackAlert />
            </Layout.Body>
          </Fragment>
        }
      >
        <ReplayDetailsContent />
      </ReplayAccess>
    </AnalyticsArea>
  );
}

function ReplayDetailsContent() {
  const user = useUser();
  const location = useLocation();
  const organization = useOrganization();
  const {replaySlug} = useParams();
  invariant(replaySlug, '`replaySlug` is required as part of the route params');

  const {slug: orgSlug} = organization;

  // TODO: replayId is known ahead of time and useReplayData is parsing it from the replaySlug
  // once we fix the route params and links we should fix this to accept replayId and stop returning it
  const readerResult = useLoadReplayReader({
    replaySlug,
    orgSlug,
  });
  const {replay, replayRecord} = readerResult;

  useReplayPageview('replay.details-time-spent');
  useRouteAnalyticsEventNames('replay_details.viewed', 'Replay Details: Viewed');
  useRouteAnalyticsParams({
    organization,
    referrer: decodeScalar(location.query.referrer),
    user_email: user.email,
    tab: location.query.t_main,
    mobile: replay?.isVideoReplay(),
  });

  const title = replayRecord
    ? `${replayRecord.user.display_name ?? t('Anonymous User')} — Session Replay — ${orgSlug}`
    : `Session Replay — ${orgSlug}`;

  const content = (
    <Fragment>
      <Flex direction="column">
        <TopHeader justify="between" align="center" gap="md">
          <ReplayDetailsPageBreadcrumbs readerResult={readerResult} />
          <ReplayDetailsHeaderActions readerResult={readerResult} />
        </TopHeader>
        <BottonHeader justify="between" align="center">
          <ReplayDetailsUserBadge readerResult={readerResult} />
          <ReplayDetailsMetadata readerResult={readerResult} />
        </BottonHeader>
      </Flex>
      <ReplayDetailsPage readerResult={readerResult} />
    </Fragment>
  );

  return (
    <SentryDocumentTitle title={title}>
      <FullViewport>
        {replay ? (
          <ReplayDetailsProviders replay={replay} projectSlug={readerResult.projectSlug}>
            {content}
          </ReplayDetailsProviders>
        ) : (
          content
        )}
      </FullViewport>
    </SentryDocumentTitle>
  );
}

const TopHeader = styled(Flex)`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.lg};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  flex-wrap: wrap;
`;

const BottonHeader = styled(Flex)`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;
