import {Fragment, useEffect} from 'react';

import {Alert} from 'sentry/components/alert';
import {Flex} from 'sentry/components/container/flex';
import DetailedError from 'sentry/components/errors/detailedError';
import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {LocalStorageReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {decodeScalar} from 'sentry/utils/queryString';
import type {TimeOffsetLocationQueryParams} from 'sentry/utils/replays/hooks/useInitialTimeOffsetMs';
import useInitialTimeOffsetMs from 'sentry/utils/replays/hooks/useInitialTimeOffsetMs';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useLogReplayDataLoaded from 'sentry/utils/replays/hooks/useLogReplayDataLoaded';
import useMarkReplayViewed from 'sentry/utils/replays/hooks/useMarkReplayViewed';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import {ReplayPreferencesContextProvider} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import ReplaysLayout from 'sentry/views/replays/detail/layout';
import Page from 'sentry/views/replays/detail/page';
import ReplayTransactionContext from 'sentry/views/replays/detail/trace/replayTransactionContext';

type Props = RouteComponentProps<
  {replaySlug: string},
  {},
  any,
  TimeOffsetLocationQueryParams
>;

function ReplayDetails({params: {replaySlug}}: Props) {
  const user = useUser();
  const location = useLocation();
  const organization = useOrganization();

  const {slug: orgSlug} = organization;

  // TODO: replayId is known ahead of time and useReplayData is parsing it from the replaySlug
  // once we fix the route params and links we should fix this to accept replayId and stop returning it
  const {
    errors,
    fetchError,
    fetching,
    onRetry,
    projectSlug,
    replay,
    replayId,
    replayRecord,
  } = useLoadReplayReader({
    replaySlug,
    orgSlug,
  });

  const replayErrors = errors.filter(e => e.title !== 'User Feedback');
  const isVideoReplay = replay?.isVideoReplay();

  useReplayPageview('replay.details-time-spent');
  useRouteAnalyticsEventNames('replay_details.viewed', 'Replay Details: Viewed');
  useRouteAnalyticsParams({
    organization,
    referrer: decodeScalar(location.query.referrer),
    user_email: user.email,
    tab: location.query.t_main,
    mobile: isVideoReplay,
  });

  useLogReplayDataLoaded({fetchError, fetching, projectSlug, replay});

  const {mutate: markAsViewed} = useMarkReplayViewed();
  useEffect(() => {
    if (
      !fetchError &&
      replayRecord &&
      !replayRecord.has_viewed &&
      projectSlug &&
      !fetching &&
      replayId
    ) {
      markAsViewed({projectSlug, replayId});
    }
  }, [
    fetchError,
    fetching,
    markAsViewed,
    organization,
    projectSlug,
    replayId,
    replayRecord,
  ]);

  const initialTimeOffsetMs = useInitialTimeOffsetMs({
    orgSlug,
    projectSlug,
    replayId,
    replayStartTimestampMs: replayRecord?.started_at?.getTime(),
  });

  const rrwebFrames = replay?.getRRWebFrames();
  // The replay data takes a while to load in, which causes `isVideoReplay`
  // to return an early `false`, which used to cause UI jumping.
  // One way to check whether it's finished loading is by checking the length
  // of the rrweb frames, which should always be > 1 for any given replay.
  // By default, the 1 frame is replay.end
  const isLoading = !rrwebFrames || (rrwebFrames && rrwebFrames.length <= 1);

  if (replayRecord?.is_archived) {
    return (
      <Page
        orgSlug={orgSlug}
        replayRecord={replayRecord}
        projectSlug={projectSlug}
        replayErrors={replayErrors}
      >
        <Layout.Page>
          <Alert.Container>
            <Alert margin system type="warning" data-test-id="replay-deleted">
              <Flex gap={space(0.5)}>
                <IconDelete color="gray500" size="sm" />
                {t('This replay has been deleted.')}
              </Flex>
            </Alert>
          </Alert.Container>
        </Layout.Page>
      </Page>
    );
  }
  if (fetchError) {
    if (fetchError.status === 404) {
      return (
        <Page
          orgSlug={orgSlug}
          replayRecord={replayRecord}
          projectSlug={projectSlug}
          replayErrors={replayErrors}
        >
          <Layout.Page withPadding>
            <NotFound />
          </Layout.Page>
        </Page>
      );
    }

    const reasons = [
      t('The replay is still processing'),
      t('The replay has been deleted by a member in your organization'),
      t('There is an internal systems error'),
    ];
    return (
      <Page
        orgSlug={orgSlug}
        replayRecord={replayRecord}
        projectSlug={projectSlug}
        replayErrors={replayErrors}
      >
        <Layout.Page>
          <DetailedError
            onRetry={onRetry}
            hideSupportLinks
            heading={t('There was an error while fetching this Replay')}
            message={
              <Fragment>
                <p>{t('This could be due to these reasons:')}</p>
                <List symbol="bullet">
                  {reasons.map((reason, i) => (
                    <ListItem key={i}>{reason}</ListItem>
                  ))}
                </List>
              </Fragment>
            }
          />
        </Layout.Page>
      </Page>
    );
  }

  return (
    <ReplayPreferencesContextProvider prefsStrategy={LocalStorageReplayPreferences}>
      <ReplayContextProvider
        analyticsContext="replay_details"
        initialTimeOffsetMs={initialTimeOffsetMs}
        isFetching={fetching}
        replay={replay}
      >
        <ReplayTransactionContext replayRecord={replayRecord}>
          <Page
            isVideoReplay={isVideoReplay}
            orgSlug={orgSlug}
            replayRecord={replayRecord}
            projectSlug={projectSlug}
            replayErrors={replayErrors}
            isLoading={isLoading}
          >
            <ReplaysLayout
              isVideoReplay={isVideoReplay}
              replayRecord={replayRecord}
              isLoading={isLoading}
            />
          </Page>
        </ReplayTransactionContext>
      </ReplayContextProvider>
    </ReplayPreferencesContextProvider>
  );
}

export default ReplayDetails;
