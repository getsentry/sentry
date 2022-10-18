import {Fragment} from 'react';
import type {RouteComponentProps} from 'react-router';

import DetailedError from 'sentry/components/errors/detailedError';
import NotFound from 'sentry/components/errors/notFound';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {
  Provider as ReplayContextProvider,
  useReplayContext,
} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import useReplayLayout from 'sentry/utils/replays/hooks/useReplayLayout';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import Layout from 'sentry/views/replays/detail/layout';
import Page from 'sentry/views/replays/detail/page';
import type {ReplayRecord} from 'sentry/views/replays/types';
import {getInitialTimeOffset} from 'sentry/views/replays/utils';

type Props = RouteComponentProps<
  {orgId: string; replaySlug: string},
  {},
  any,
  {event_t: string; t: number}
>;

function ReplayDetails({
  location: {
    query: {
      event_t: eventTimestamp, // Timestamp of the event or activity that was selected
      t: initialTimeOffset, // Time, in seconds, where the video should start
    },
  },
  params: {orgId: orgSlug, replaySlug},
}: Props) {
  useReplayPageview();

  const {fetching, onRetry, replay, replayRecord, fetchError} = useReplayData({
    replaySlug,
    orgSlug,
  });

  const startTimestampMs = replayRecord?.startedAt.getTime() ?? 0;

  if (!fetching && !replay && fetchError) {
    if (fetchError.statusText === 'Not Found') {
      return (
        <Page orgSlug={orgSlug} replayRecord={replayRecord}>
          <PageContent>
            <NotFound />
          </PageContent>
        </Page>
      );
    }

    const reasons = [
      t('The Replay is still processing and is on its way'),
      t('There is an internal systems error or active issue'),
    ];
    return (
      <Page orgSlug={orgSlug} replayRecord={replayRecord}>
        <PageContent>
          <DetailedError
            onRetry={onRetry}
            hideSupportLinks
            heading={t('There was an error while fetching this Replay')}
            message={
              <Fragment>
                <p>{t('This could be due to a couple of reasons:')}</p>
                <List symbol="bullet">
                  {reasons.map((reason, i) => (
                    <ListItem key={i}>{reason}</ListItem>
                  ))}
                </List>
              </Fragment>
            }
          />
        </PageContent>
      </Page>
    );
  }

  if (!fetching && replay && replay.getRRWebEvents().length < 2) {
    return (
      <Page orgSlug={orgSlug} replayRecord={replayRecord}>
        <DetailedError
          hideSupportLinks
          heading={t('Expected two or more replay events')}
          message={
            <Fragment>
              <p>{t('This Replay may not have captured any user actions.')}</p>
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
      replay={replay}
      initialTimeOffset={getInitialTimeOffset({
        eventTimestamp,
        initialTimeOffset,
        startTimestampMs,
      })}
    >
      <LoadedDetails orgSlug={orgSlug} replayRecord={replayRecord} />
    </ReplayContextProvider>
  );
}

function LoadedDetails({
  orgSlug,
  replayRecord,
}: {
  orgSlug: string;
  replayRecord: ReplayRecord | undefined;
}) {
  const {getLayout} = useReplayLayout();
  const {replay} = useReplayContext();

  return (
    <Page orgSlug={orgSlug} crumbs={replay?.getRawCrumbs()} replayRecord={replayRecord}>
      <Layout layout={getLayout()} />
    </Page>
  );
}

export default ReplayDetails;
