import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import invariant from 'invariant';

import AnalyticsArea from 'sentry/components/analyticsArea';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useReplayListQueryKey from 'sentry/utils/replays/hooks/useReplayListQueryKey';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useUrlParams from 'sentry/utils/url/useUrlParams';
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
import type {ReplayListRecord} from 'sentry/views/replays/types';

export default function ReplayDetails() {
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

  const {playlistStart, ...query} = useLocationQuery({
    fields: {
      cursor: decodeScalar,
      environment: decodeList,
      project: decodeList,
      sort: decodeScalar,
      query: decodeScalar,
      playlistStart: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
    },
  });
  const {getParamValue} = useUrlParams('sort');
  const sortQuery = getParamValue();

  const queryKey = useReplayListQueryKey({
    options: {query: {...query, start: playlistStart, sort: sortQuery}},
    organization,
    queryReferrer: 'replayList',
  });
  const {data} = useApiQuery<{
    data: ReplayListRecord[];
    enabled: true;
  }>(queryKey, {staleTime: 0});

  const replays = useMemo(() => data?.data?.map(mapResponseToReplayRecord) ?? [], [data]);

  const currentReplayIndex = useMemo(
    () => replays.findIndex(r => r.id === replayRecord?.id),
    [replays, replayRecord]
  );

  const nextReplay = useMemo(
    () =>
      currentReplayIndex < replays.length - 1
        ? replays[currentReplayIndex + 1]
        : undefined,
    [replays, currentReplayIndex]
  );
  const previousReplay = useMemo(
    () => (currentReplayIndex > 0 ? replays[currentReplayIndex - 1] : undefined),
    [replays, currentReplayIndex]
  );

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
        <ReplayDetailsPageBreadcrumbs
          readerResult={readerResult}
          nextReplay={nextReplay}
          previousReplay={previousReplay}
        />
        <ReplayDetailsHeaderActions readerResult={readerResult} />
        <ReplayDetailsUserBadge readerResult={readerResult} />
        <ReplayDetailsMetadata readerResult={readerResult} />
      </Header>
      <ReplayDetailsPage readerResult={readerResult} />
    </Fragment>
  );
  return (
    <AnalyticsArea name="details">
      <SentryDocumentTitle title={title}>
        <FullViewport>
          {replay ? (
            <ReplayDetailsProviders
              replay={replay}
              projectSlug={readerResult.projectSlug}
            >
              {content}
            </ReplayDetailsProviders>
          ) : (
            content
          )}
        </FullViewport>
      </SentryDocumentTitle>
    </AnalyticsArea>
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
