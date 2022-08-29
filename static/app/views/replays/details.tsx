import {Fragment} from 'react';
import type {RouteComponentProps} from 'react-router';

import DetailedError from 'sentry/components/errors/detailedError';
import NotFound from 'sentry/components/errors/notFound';
import {
  Provider as ReplayContextProvider,
  useReplayContext,
} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import useReplayLayout from 'sentry/utils/replays/hooks/useReplayLayout';
import Layout from 'sentry/views/replays/detail/layout';
import Page from 'sentry/views/replays/detail/page';

type Props = RouteComponentProps<
  {orgSlug: string; replaySlug: string},
  {},
  any,
  {t: number}
>;

function ReplayDetails({
  location: {
    query: {
      t: initialTimeOffset, // Time, in seconds, where the video should start
    },
  },
  params: {orgSlug, replaySlug},
}: Props) {
  const {fetching, onRetry, replay} = useReplayData({
    replaySlug,
    orgSlug,
  });

  if (!fetching && !replay) {
    return (
      <Page orgSlug={orgSlug}>
        <PageContent>
          <NotFound />
        </PageContent>
      </Page>
    );
  }

  if (!fetching && replay && replay.getRRWebEvents().length < 2) {
    return (
      <Page orgSlug={orgSlug} replayRecord={replay.getReplay()}>
        <DetailedError
          onRetry={onRetry}
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
    <ReplayContextProvider replay={replay} initialTimeOffset={initialTimeOffset}>
      <LoadedDetails orgSlug={orgSlug} />
    </ReplayContextProvider>
  );
}

function LoadedDetails({orgSlug}: {orgSlug: string}) {
  const {getLayout} = useReplayLayout();
  const {replay} = useReplayContext();

  return (
    <Page
      orgSlug={orgSlug}
      crumbs={replay?.getRawCrumbs()}
      replayRecord={replay?.getReplay()}
    >
      <Layout layout={getLayout()} />
    </Page>
  );
}

export default ReplayDetails;
