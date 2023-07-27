import {Fragment} from 'react';
import type {RouteComponentProps} from 'react-router';

import DetailedError from 'sentry/components/errors/detailedError';
import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {
  Provider as ReplayContextProvider,
  useReplayContext,
} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {decodeScalar} from 'sentry/utils/queryString';
import useInitialTimeOffsetMs, {
  TimeOffsetLocationQueryParams,
} from 'sentry/utils/replays/hooks/useInitialTimeOffsetMs';
import useLogReplayDataLoaded from 'sentry/utils/replays/hooks/useLogReplayDataLoaded';
import useReplayLayout from 'sentry/utils/replays/hooks/useReplayLayout';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import ReplaysLayout from 'sentry/views/replays/detail/layout';
import Page from 'sentry/views/replays/detail/page';
import ReplayTransactionContext from 'sentry/views/replays/detail/trace/replayTransactionContext';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type Props = RouteComponentProps<
  {replaySlug: string},
  {},
  any,
  TimeOffsetLocationQueryParams
>;

function ReplayDetails({params: {replaySlug}}: Props) {
  const config = useLegacyStore(ConfigStore);
  const location = useLocation();
  const organization = useOrganization();

  useReplayPageview('replay.details-time-spent');
  useRouteAnalyticsEventNames('replay_details.viewed', 'Replay Details: Viewed');
  useRouteAnalyticsParams({
    organization,
    referrer: decodeScalar(location.query.referrer),
    user_email: config.user.email,
    tab: location.query.t_main,
  });

  const {slug: orgSlug} = organization;

  // TODO: replayId is known ahead of time and useReplayData is parsing it from the replaySlug
  // once we fix the route params and links we should fix this to accept replayId and stop returning it
  const {
    errors: replayErrors,
    fetchError,
    fetching,
    onRetry,
    projectSlug,
    replay,
    replayId,
    replayRecord,
  } = useReplayReader({
    replaySlug,
    orgSlug,
  });

  useLogReplayDataLoaded({fetchError, fetching, projectSlug, replay});

  const initialTimeOffsetMs = useInitialTimeOffsetMs({
    orgSlug,
    projectSlug,
    replayId,
    replayStartTimestampMs: replayRecord?.started_at.getTime(),
  });

  if (fetchError) {
    if (fetchError.statusText === 'Not Found') {
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

  if (!fetching && replay && replay.getRRWebFrames().length < 2) {
    return (
      <Page
        orgSlug={orgSlug}
        replayRecord={replayRecord}
        projectSlug={projectSlug}
        replayErrors={replayErrors}
      >
        <DetailedError
          hideSupportLinks
          heading={t('Error loading replay')}
          message={
            <Fragment>
              <p>
                {t(
                  'Expected two or more replay events. This Replay may not have captured any user actions.'
                )}
              </p>
              <p>
                {t(
                  'Or there may be an issue loading the actions from the server, click to try loading the Replay again.'
                )}
              </p>
            </Fragment>
          }
        />
      </Page>
    );
  }

  return (
    <ReplayContextProvider
      isFetching={fetching}
      replay={replay}
      initialTimeOffsetMs={initialTimeOffsetMs}
    >
      <ReplayTransactionContext replayRecord={replayRecord}>
        <DetailsInsideContext
          orgSlug={orgSlug}
          replayRecord={replayRecord}
          projectSlug={projectSlug}
          replayErrors={replayErrors}
        />
      </ReplayTransactionContext>
    </ReplayContextProvider>
  );
}

function DetailsInsideContext({
  orgSlug,
  replayRecord,
  projectSlug,
  replayErrors,
}: {
  orgSlug: string;
  projectSlug: string | null;
  replayErrors: ReplayError[];
  replayRecord: ReplayRecord | undefined;
}) {
  const {getLayout} = useReplayLayout();
  const {replay} = useReplayContext();

  return (
    <Page
      orgSlug={orgSlug}
      frames={replay?.getNavigationFrames()}
      replayRecord={replayRecord}
      projectSlug={projectSlug}
      replayErrors={replayErrors}
    >
      <ReplaysLayout layout={getLayout()} />
    </Page>
  );
}

export default ReplayDetails;
