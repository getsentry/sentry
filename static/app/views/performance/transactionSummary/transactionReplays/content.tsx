import {useTheme} from '@emotion/react';
import {type Location} from 'history';
import first from 'lodash/first';

import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import type {Organization} from 'sentry/types';
import type EventView from 'sentry/utils/discover/eventView';
import useMedia from 'sentry/utils/useMedia';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

import type {SpanOperationBreakdownFilter} from '../filter';
import {
  type EventsDisplayFilterName,
  type PercentileValues,
} from '../transactionEvents/utils';

import type {ReplayListRecordWithTx} from './useReplaysFromTransaction';

type Props = {
  eventView: EventView;
  eventsDisplayFilterName: EventsDisplayFilterName;
  isFetching: boolean;
  location: Location<ReplayListLocationQuery>;
  organization: Organization;
  pageLinks: string | null;
  replays: ReplayListRecordWithTx[];
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  percentileValues?: PercentileValues;
};

function ReplaysContent({eventView, isFetching, pageLinks, replays}: Props) {
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.small})`);

  return (
    <Layout.Main fullWidth>
      <ReplayTable
        fetchError={undefined}
        isFetching={isFetching}
        replays={replays}
        sort={first(eventView.sorts) || {field: 'started_at', kind: 'asc'}}
        visibleColumns={[
          ReplayColumns.session,
          ...(hasRoomForColumns
            ? [ReplayColumns.slowestTransaction, ReplayColumns.startedAt]
            : []),
          ReplayColumns.duration,
          ReplayColumns.countErrors,
          ReplayColumns.activity,
        ]}
      />
      <Pagination pageLinks={pageLinks} />
    </Layout.Main>
  );
}

export default ReplaysContent;
