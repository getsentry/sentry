import {Fragment} from 'react';

import DetailedError from 'sentry/components/errors/detailedError';
import NotFound from 'sentry/components/errors/notFound';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import useUrlParam from 'sentry/utils/replays/hooks/useUrlParams';
import {useRouteContext} from 'sentry/utils/useRouteContext';
import Layout from 'sentry/views/replays/detail/layout';
import Page from 'sentry/views/replays/detail/page';

function ReplayDetails() {
  const {
    location,
    params: {eventSlug, orgId},
  } = useRouteContext();

  const {
    t: initialTimeOffset, // Time, in seconds, where the video should start
  } = location.query;

  const {getParamValue} = useUrlParam('l_page', 'topbar');

  const {fetching, onRetry, replay} = useReplayData({
    eventSlug,
    orgId,
  });

  if (!fetching && !replay) {
    return (
      <Page eventSlug={eventSlug} orgId={orgId}>
        <PageContent>
          <NotFound />
        </PageContent>
      </Page>
    );
  }

  if (!fetching && replay && replay.getRRWebEvents().length < 2) {
    return (
      <Page eventSlug={eventSlug} orgId={orgId} event={replay.getEvent()}>
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
    <Page eventSlug={eventSlug} orgId={orgId} event={replay?.getEvent()}>
      <ReplayContextProvider replay={replay} initialTimeOffset={initialTimeOffset}>
        <Layout layout={getParamValue() === 'sidebar' ? 'sidebar' : 'topbar'} />
      </ReplayContextProvider>
    </Page>
  );
}

export default ReplayDetails;
