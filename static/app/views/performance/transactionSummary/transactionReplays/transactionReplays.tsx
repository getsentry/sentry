import {useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import {useQuery} from '@tanstack/react-query';

import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {
  ReplayAccess,
  ReplayAccessFallbackAlert,
} from 'sentry/components/replays/replayAccess';
import {ReplayTable} from 'sentry/components/replays/table/replayTable';
import {
  ReplayActivityColumn,
  ReplayBrowserColumn,
  ReplayCountErrorsColumn,
  ReplayDurationColumn,
  ReplayOSColumn,
  ReplaySessionColumn,
  ReplaySlowestTransactionColumn,
} from 'sentry/components/replays/table/replayTableColumns';
import {useReplayTableSort} from 'sentry/components/replays/table/useReplayTableSort';
import {usePlaylistQuery} from 'sentry/components/replays/usePlaylistQuery';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {EventView} from 'sentry/utils/discover/eventView';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import {replayListApiOptions} from 'sentry/utils/replays/replayListApiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useMedia} from 'sentry/utils/useMedia';
import {useAllMobileProj} from 'sentry/views/explore/replays/detail/useAllMobileProj';
import {useTransactionSummaryContext} from 'sentry/views/performance/transactionSummary/transactionSummaryContext';

import {useReplaysFromTransaction} from './useReplaysFromTransaction';
import {useReplaysWithTxData} from './useReplaysWithTxData';

export function TransactionReplays() {
  return (
    <ReplayAccess fallback={<ReplayAccessFallbackAlert />}>
      <TransactionReplaysContent />
    </ReplayAccess>
  );
}

function TransactionReplaysContent() {
  const {organization, transactionName, setError} = useTransactionSummaryContext();

  const {
    replayIds,
    events,
    isFetching: isFetchingIds,
    fetchError,
  } = useReplaysFromTransaction({transactionName});

  useEffect(() => {
    setError(fetchError?.message ?? undefined);
  }, [setError, fetchError]);

  const {sortQuery} = useReplayTableSort();

  // Hard-code 90d to match the count query. There's no date selector for the replay tab.
  const replayListOptions = replayListApiOptions({
    options: {
      query: {
        query: replayIds.length ? `id:[${replayIds.join(',')}]` : undefined,
        statsPeriod: '90d',
        sort: sortQuery,
      },
    },
    organization,
    queryReferrer: 'transactionReplays',
  });

  // for the replay tab in transactions, if payload.query is undefined,
  // this means the transaction has no related replays.
  // but because we cannot query for an empty list of IDs (e.g. `id:[]` breaks our search endpoint),
  // and leaving query empty results in ALL replays being returned for a specified project
  // (which doesn't make sense as we want to show no replays),
  // we essentially want to hardcode no replays being returned.
  const {
    data: response,
    isFetching: isFetchingReplays,
    error: replayError,
  } = useQuery({
    ...replayListOptions,
    enabled: replayIds.length > 0,
    select: selectJsonWithHeaders,
  });

  const replays = useMemo(
    () => response?.json?.data?.map(mapResponseToReplayRecord) ?? [],
    [response]
  );

  const replaysWithTx = useReplaysWithTxData({
    replays,
    events,
  });

  const location = useLocation();
  const playlistEventView = useMemo(
    () =>
      EventView.fromSavedQuery({
        id: '',
        name: '',
        version: 2,
        fields: [],
        projects: [],
        query: String(location.query.query ?? ''),
      }),
    [location.query.query]
  );
  const playlistQuery = usePlaylistQuery('transactionReplays', playlistEventView);

  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.sm})`);
  const {allMobileProj} = useAllMobileProj({});

  if (isFetchingIds && !replayIds.length) {
    return (
      <Layout.Main width="full">
        <LoadingIndicator />
      </Layout.Main>
    );
  }

  return (
    <Layout.Main width="full">
      <ReplayTable
        query={playlistQuery}
        columns={[
          ReplaySessionColumn,
          ...(hasRoomForColumns ? [ReplaySlowestTransactionColumn] : []),
          ReplayOSColumn,
          ...(allMobileProj ? [] : [ReplayBrowserColumn]),
          ReplayDurationColumn,
          ReplayCountErrorsColumn,
          ReplayActivityColumn,
        ]}
        error={replayError}
        isPending={isFetchingIds || isFetchingReplays}
        replays={replaysWithTx ?? []}
        showDropdownFilters={false}
      />
    </Layout.Main>
  );
}
