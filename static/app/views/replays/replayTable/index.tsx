import {Fragment, ReactNode} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Alert} from 'sentry/components/alert';
import PanelTable from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import HeaderCell from 'sentry/views/replays/replayTable/headerCell';
import {
  ActivityCell,
  BrowserCell,
  DeadClickCountCell,
  DurationCell,
  ErrorCountCell,
  OSCell,
  RageClickCountCell,
  ReplayCell,
  TransactionCell,
} from 'sentry/views/replays/replayTable/tableCell';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  fetchError: undefined | Error;
  isFetching: boolean;
  replays: undefined | ReplayListRecord[] | ReplayListRecordWithTx[];
  sort: Sort | undefined;
  visibleColumns: ReplayColumn[];
  emptyMessage?: ReactNode;
  headersSortable?: boolean;
  saveLocation?: boolean;
};

export function ReplayTable({
  fetchError,
  isFetching,
  replays,
  sort,
  visibleColumns,
  emptyMessage,
  saveLocation,
  headersSortable,
}: Props) {
  const routes = useRoutes();
  const newLocation = useLocation();
  const organization = useOrganization();

  const location: Location =
    saveLocation ?? false
      ? {
          pathname: '',
          search: '',
          query: {},
          hash: '',
          state: '',
          action: 'PUSH',
          key: '',
        }
      : newLocation;

  const tableHeaders = visibleColumns
    .filter(Boolean)
    .map(column => (
      <HeaderCell
        key={column}
        column={column}
        sort={sort}
        headersSortable={headersSortable}
      />
    ));

  if (fetchError && !isFetching) {
    return (
      <StyledPanelTable
        headers={tableHeaders}
        isLoading={false}
        visibleColumns={visibleColumns}
        data-test-id="replay-table"
      >
        <StyledAlert type="error" showIcon>
          {typeof fetchError === 'string'
            ? fetchError
            : t(
                'Sorry, the list of replays could not be loaded. This could be due to invalid search parameters or an internal systems error.'
              )}
        </StyledAlert>
      </StyledPanelTable>
    );
  }

  const referrer = getRouteStringFromRoutes(routes);
  const eventView = EventView.fromLocation(location);

  return (
    <StyledPanelTable
      headers={tableHeaders}
      isEmpty={replays?.length === 0}
      isLoading={isFetching}
      visibleColumns={visibleColumns}
      disablePadding
      data-test-id="replay-table"
      emptyMessage={emptyMessage}
    >
      {replays?.map(replay => {
        return (
          <Fragment key={replay.id}>
            {visibleColumns.map(column => {
              switch (column) {
                case ReplayColumn.ACTIVITY:
                  return <ActivityCell key="activity" replay={replay} />;

                case ReplayColumn.BROWSER:
                  return <BrowserCell key="browser" replay={replay} />;

                case ReplayColumn.COUNT_DEAD_CLICKS:
                  return <DeadClickCountCell key="countDeadClicks" replay={replay} />;

                case ReplayColumn.COUNT_ERRORS:
                  return <ErrorCountCell key="countErrors" replay={replay} />;

                case ReplayColumn.COUNT_RAGE_CLICKS:
                  return <RageClickCountCell key="countRageClicks" replay={replay} />;

                case ReplayColumn.DURATION:
                  return <DurationCell key="duration" replay={replay} />;

                case ReplayColumn.OS:
                  return <OSCell key="os" replay={replay} />;

                case ReplayColumn.REPLAY:
                  return (
                    <ReplayCell
                      key="session"
                      replay={replay}
                      eventView={eventView}
                      organization={organization}
                      referrer={referrer}
                      showUrl
                    />
                  );

                case ReplayColumn.SLOWEST_TRANSACTION:
                  return (
                    <TransactionCell
                      key="slowestTransaction"
                      replay={replay}
                      organization={organization}
                    />
                  );

                case ReplayColumn.MOST_DEAD_CLICKS:
                  return (
                    <ReplayCell
                      key="mostDeadClicks"
                      replay={replay}
                      organization={organization}
                      referrer={referrer}
                      showUrl={false}
                      eventView={eventView}
                    />
                  );

                case ReplayColumn.MOST_ERRONEOUS_REPLAYS:
                  return (
                    <ReplayCell
                      key="mostErroneousReplays"
                      replay={replay}
                      organization={organization}
                      referrer={referrer}
                      showUrl={false}
                      eventView={eventView}
                    />
                  );

                default:
                  return null;
              }
            })}
          </Fragment>
        );
      })}
    </StyledPanelTable>
  );
}

const replayDetailCells = [
  ReplayColumn.REPLAY,
  ReplayColumn.MOST_DEAD_CLICKS,
  ReplayColumn.MOST_ERRONEOUS_REPLAYS,
];

const StyledPanelTable = styled(PanelTable)<{
  visibleColumns: ReplayColumn[];
}>`
  grid-template-columns: ${p =>
    p.visibleColumns
      .filter(Boolean)
      .map(column =>
        replayDetailCells.includes(column) ? 'minmax(100px, 1fr)' : 'max-content'
      )
      .join(' ')};
`;

const StyledAlert = styled(Alert)`
  border-radius: 0;
  border-width: 1px 0 0 0;
  grid-column: 1/-1;
  margin-bottom: 0;
`;
