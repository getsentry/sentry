import {useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';

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
import {DEFAULT_REPLAY_LIST_SORT} from 'sentry/components/replays/table/useReplayTableSort';
import {usePlaylistQuery} from 'sentry/components/replays/usePlaylistQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useMedia} from 'sentry/utils/useMedia';
import {useAllMobileProj} from 'sentry/views/explore/replays/detail/useAllMobileProj';
import {useTransactionSummaryContext} from 'sentry/views/performance/transactionSummary/transactionSummaryContext';

import {useTransactionReplays} from './useTransactionReplays';
import {generateTransactionReplaysEventView} from './utils';

export function TransactionReplays() {
  return (
    <ReplayAccess fallback={<ReplayAccessFallbackAlert />}>
      <TransactionReplaysContent />
    </ReplayAccess>
  );
}

function TransactionReplaysContent() {
  const {transactionName, setError} = useTransactionSummaryContext();

  const location = useLocation();
  const replayIdsEventView = useMemo(
    () => generateTransactionReplaysEventView({location, transactionName}),
    [location, transactionName]
  );
  const sort = decodeScalar(location.query.sort, DEFAULT_REPLAY_LIST_SORT);

  const {replays, isPending, error, playlistEventView} = useTransactionReplays({
    transactionName,
    sort,
    replayIdsEventView,
    location,
  });

  useEffect(() => {
    if (error instanceof Error) {
      setError(error.message);
    } else if (typeof error === 'string') {
      setError(error);
    } else {
      setError(undefined);
    }
  }, [setError, error]);

  const playlistQuery = usePlaylistQuery('transactionReplays', playlistEventView);
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.sm})`);
  const {allMobileProj} = useAllMobileProj({});

  if (isPending) {
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
        error={error instanceof Error ? error : undefined}
        isPending={false}
        replays={replays ?? []}
        showDropdownFilters={false}
      />
    </Layout.Main>
  );
}
