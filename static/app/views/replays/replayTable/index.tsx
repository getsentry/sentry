import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {PanelTable} from 'sentry/components/panels';
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
  DurationCell,
  ErrorCountCell,
  OSCell,
  ReplayCell,
  TransactionCell,
} from 'sentry/views/replays/replayTable/tableCell';
import {ReplayColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  fetchError: undefined | Error;
  isFetching: boolean;
  replays: undefined | ReplayListRecord[] | ReplayListRecordWithTx[];
  sort: Sort | undefined;
  visibleColumns: Array<keyof typeof ReplayColumns>;
};

function ReplayTable({fetchError, isFetching, replays, sort, visibleColumns}: Props) {
  const routes = useRoutes();
  const location = useLocation();
  const organization = useOrganization();

  const tableHeaders = visibleColumns
    .filter(Boolean)
    .map(column => <HeaderCell key={column} column={column} sort={sort} />);

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
    >
      {replays?.map(replay => {
        return (
          <Fragment key={replay.id}>
            {visibleColumns.map(column => {
              switch (column) {
                case ReplayColumns.activity:
                  return <ActivityCell key="activity" replay={replay} />;

                case ReplayColumns.browser:
                  return <BrowserCell key="browser" replay={replay} />;

                case ReplayColumns.countErrors:
                  return <ErrorCountCell key="countErrors" replay={replay} />;

                case ReplayColumns.duration:
                  return <DurationCell key="duration" replay={replay} />;

                case ReplayColumns.os:
                  return <OSCell key="os" replay={replay} />;

                case ReplayColumns.replay:
                  return (
                    <ReplayCell
                      key="session"
                      replay={replay}
                      eventView={eventView}
                      organization={organization}
                      referrer={referrer}
                    />
                  );

                case ReplayColumns.slowestTransaction:
                  return (
                    <TransactionCell
                      key="slowestTransaction"
                      replay={replay}
                      organization={organization}
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

const StyledPanelTable = styled(PanelTable)<{
  visibleColumns: Array<keyof typeof ReplayColumns>;
}>`
  grid-template-columns: ${p =>
    p.visibleColumns
      .filter(Boolean)
      .map(column => (column === 'replay' ? 'minmax(100px, 1fr)' : 'max-content'))
      .join(' ')};
`;

const StyledAlert = styled(Alert)`
  border-radius: 0;
  border-width: 1px 0 0 0;
  grid-column: 1/-1;
  margin-bottom: 0;
`;

export default ReplayTable;
