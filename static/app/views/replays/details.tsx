import {Fragment} from 'react';
import styled from '@emotion/styled';

import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {decodeScalar} from 'sentry/utils/queryString';
import type {TimeOffsetLocationQueryParams} from 'sentry/utils/replays/hooks/useInitialTimeOffsetMs';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import ReplayDetailsProviders from 'sentry/views/replays/detail/body/replayDetailsProviders';
import ReplayDetailsHeaderActions from 'sentry/views/replays/detail/header/replayDetailsHeaderActions';
import ReplayDetailsMetadata from 'sentry/views/replays/detail/header/replayDetailsMetadata';
import ReplayDetailsPageBreadcrumbs from 'sentry/views/replays/detail/header/replayDetailsPageBreadcrumbs';
import ReplayDetailsUserBadge from 'sentry/views/replays/detail/header/replayDetailsUserBadge';
import ReplayDetailsPage from 'sentry/views/replays/detail/page';

type Props = RouteComponentProps<
  {replaySlug: string},
  any,
  TimeOffsetLocationQueryParams
>;

export default function ReplayDetails({params: {replaySlug}}: Props) {
  const user = useUser();
  const location = useLocation();
  const organization = useOrganization();

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
      <Header>
        <ReplayDetailsPageBreadcrumbs readerResult={readerResult} />
        <ReplayDetailsHeaderActions readerResult={readerResult} />
        <ReplayDetailsUserBadge readerResult={readerResult} />
        <ReplayDetailsMetadata readerResult={readerResult} />
      </Header>
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

const Header = styled(Layout.Header)`
  gap: ${space(1)};
  padding-bottom: ${space(1.5)};
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    gap: ${space(1)} ${space(3)};
    padding: ${space(2)} ${space(2)} ${space(1.5)} ${space(2)};
  }
`;
