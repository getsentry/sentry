import {Fragment, useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
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

  const newLocation = useMemo(
    () => ({query: {}}) as Location<ReplayListLocationQuery>,
    []
  );
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.sm})`);

  const {replays, isFetching, fetchError} = useReplayList({
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
