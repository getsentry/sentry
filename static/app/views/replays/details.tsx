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
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import Layout from 'sentry/views/replays/detail/layout';
import Page from 'sentry/views/replays/detail/page';

type Props = RouteComponentProps<
  {orgId: string; replaySlug: string},
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
  params: {orgId: orgSlug, replaySlug},
}: Props) {
  useReplayPageview();
  const {fetching, onRetry, replay, fetchError} = useReplayData({
    replaySlug,
    orgSlug,
  });

  if (!fetching && !replay && fetchError) {
    if (fetchError.statusText === 'Not Found') {
      return (
        <Page orgSlug={orgSlug}>
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
      <Page orgSlug={orgSlug}>
        <PageContent>
          <DetailedError
            onRetry={onRetry}
            hideSupportLinks
            heading={t('There was an error while fetching this Replay')}
            message={
              <Fragment>
                <p>{t('This could be due to a couple of reasons:')}</p>
                <ol className="detailed-error-list">
                  {reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ol>
              </Fragment>
            }
          />
        </PageContent>
      </Page>
    );
  }

  if (!fetching && replay && replay.getRRWebEvents().length < 2) {
    return (
      <Page orgSlug={orgSlug} replayRecord={replay.getReplay()}>
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
