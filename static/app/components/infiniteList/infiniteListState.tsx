import {Fragment} from 'react';
import type {UseInfiniteQueryResult, UseQueryResult} from '@tanstack/react-query';

import type {ApiResult} from 'sentry/api';
import {t} from 'sentry/locale';

interface Props<Data> {
  children: React.ReactNode;
  queryResult:
    | Pick<UseQueryResult<ApiResult<Data>, Error>, 'status' | 'error' | 'isFetching'>
    | Pick<
        UseInfiniteQueryResult<Data, Error>,
        'status' | 'error' | 'isFetching' | 'isFetchingNextPage'
      >;
  backgroundUpdatingMessage?: () => React.ReactNode;
  errorMessage?: (props: {error: Error}) => React.ReactNode;
  loadingMessage?: () => React.ReactNode;
}

export default function InfiniteListState<Data>({
  backgroundUpdatingMessage = BackgroundUpdatingMessage,
  children,
  errorMessage = ErrorMessage,
  loadingMessage = LoadingMessage,
  queryResult,
}: Props<Data>) {
  const {status, error, isFetching} = queryResult;
  if (status === 'pending') {
    return loadingMessage();
  }
  if (status === 'error') {
    return errorMessage({error: error!});
  }

  // It's fetching in the background if:
  // - it's a regular QueryResult, and isFetching is true
  // - it's an InfiniteQueryResult, and itFetching is true, but we're not fetching the next page
  const isBackgroundUpdating =
    isFetching &&
    ('isFetchingNextPage' in queryResult ? !queryResult.isFetchingNextPage : true);

  return (
    <Fragment>
      {children}
      {isBackgroundUpdating ? backgroundUpdatingMessage() : null}
    </Fragment>
  );
}

function LoadingMessage() {
  return <p>{t('Loading...')}</p>;
}

function ErrorMessage({error}: {error: Error}) {
  return <p>{t('Error: %s', error.message)}</p>;
}

function BackgroundUpdatingMessage() {
  return <footer>{t('Background Updating...')}</footer>;
}
