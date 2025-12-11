import {Fragment, useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  ReplayAccess,
  ReplayAccessFallbackAlert,
} from 'sentry/components/replays/replayAccess';
import ReplayTable from 'sentry/components/replays/table/replayTable';
import {
  ReplayActivityColumn,
  ReplayBrowserColumn,
  ReplayCountErrorsColumn,
  ReplayDurationColumn,
  ReplayOSColumn,
  ReplaySessionColumn,
  ReplaySlowestTransactionColumn,
} from 'sentry/components/replays/table/replayTableColumns';
import {usePlaylistQuery} from 'sentry/components/replays/usePlaylistQuery';
import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import {useTransactionSummaryContext} from 'sentry/views/performance/transactionSummary/transactionSummaryContext';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

import type {EventSpanData} from './useReplaysFromTransaction';
import useReplaysFromTransaction from './useReplaysFromTransaction';
import useReplaysWithTxData from './useReplaysWithTxData';

function TransactionReplays() {
  return (
    <ReplayAccess fallback={<ReplayAccessFallbackAlert />}>
      <TransactionReplaysContent />
    </ReplayAccess>
  );
}

function TransactionReplaysContent() {
  const {
    eventView: replayIdsEventView,
    organization,
    setError,
  } = useTransactionSummaryContext();

  const location = useLocation();

  // Hard-code 90d to match the count query. There's no date selector for the replay tab.
  const {data, fetchError, isFetching, pageLinks} = useReplaysFromTransaction({
    replayIdsEventView,
    location: {
      ...location,
      query: {
        ...location.query,
        statsPeriod: '90d',
      },
    },
    organization,
  });

  useEffect(() => {
    setError(fetchError?.message ?? fetchError);
  }, [setError, fetchError]);

  if (!data) {
    return isFetching ? (
      <Layout.Main width="full">
        <LoadingIndicator />
      </Layout.Main>
    ) : (
      <Fragment>{null}</Fragment>
    );
  }

  const {events, replayRecordsEventView} = data;
  return (
    <ReplaysContent
      eventView={replayRecordsEventView}
      events={events}
      organization={organization}
      pageLinks={pageLinks}
    />
  );
}

function ReplaysContent({
  eventView,
  events,
  organization,
}: {
  eventView: EventView;
  events: EventSpanData[];
  organization: Organization;
  pageLinks: string | null;
}) {
  const location = useLocation();

  if (!eventView.query) {
    eventView.query = String(location.query.query ?? '');
  }
  const playlistQuery = usePlaylistQuery('transactionReplays', eventView);

  const newLocation = useMemo(
    () => ({query: {}}) as Location<ReplayListLocationQuery>,
    []
  );
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.sm})`);

  const {replays, isFetching, fetchError} = useReplayList({
    enabled: eventView.query !== '',
    // for the replay tab in transactions, if payload.query is undefined,
    // this means the transaction has no related replays.
    // but because we cannot query for an empty list of IDs (e.g. `id:[]` breaks our search endpoint),
    // and leaving query empty results in ALL replays being returned for a specified project
    // (which doesn't make sense as we want to show no replays),
    // we essentially want to hardcode no replays being returned.
    eventView,
    location: newLocation,
    organization,
    queryReferrer: 'transactionReplays',
  });

  const replaysWithTx = useReplaysWithTxData({
    replays,
    events,
  });

  const {allMobileProj} = useAllMobileProj({});

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
        error={fetchError}
        isPending={isFetching}
        replays={replaysWithTx ?? []}
        showDropdownFilters={false}
      />
    </Layout.Main>
  );
}
export default TransactionReplays;
