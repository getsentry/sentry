import {Fragment} from 'react';

import DetailedError from 'sentry/components/errors/detailedError';
import NotFound from 'sentry/components/errors/notFound';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t} from 'sentry/locale';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';

type ReaderResult = ReturnType<typeof useLoadReplayReader>;

interface Props {
  fetchError: ReaderResult['fetchError'];
  onRetry: ReaderResult['onRetry'];
}

export default function ReplayDetailsError({fetchError, onRetry}: Props) {
  const reasons = [
    t('The replay is still processing'),
    t('The replay has been deleted by a member in your organization'),
    t('There is an internal systems error'),
  ];
  return fetchError?.status === 404 ? (
    <NotFound />
  ) : (
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
  );
}
