import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {PanelTable} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysFromTransaction';
import HeaderCell from 'sentry/views/replays/replayTable/headerCell';
import TableCell from 'sentry/views/replays/replayTable/tableCell';
import type {VisibleColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  fetchError: undefined | Error;
  isFetching: boolean;
  replays: undefined | ReplayListRecord[] | ReplayListRecordWithTx[];
  sort: Sort | undefined;
  visibleColumns: VisibleColumns;
};

function ReplayTable({fetchError, isFetching, replays, sort, visibleColumns}: Props) {
  const routes = useRoutes();
  const location = useLocation();
  const referrer = getRouteStringFromRoutes(routes);

  const organization = useOrganization();

  const tableHeaders = [
    visibleColumns.session ? <HeaderCell column="session" sort={sort} /> : null,
    visibleColumns.projectId ? <HeaderCell column="projectId" sort={sort} /> : null,
    visibleColumns.slowestTransaction ? (
      <HeaderCell column="slowestTransaction" sort={sort} />
    ) : null,
    visibleColumns.startedAt ? <HeaderCell column="startedAt" sort={sort} /> : null,
    visibleColumns.duration ? <HeaderCell column="duration" sort={sort} /> : null,
    visibleColumns.countErrors ? <HeaderCell column="countErrors" sort={sort} /> : null,
    visibleColumns.activity ? <HeaderCell column="activity" sort={sort} /> : null,
  ].filter(Boolean);

  if (fetchError && !isFetching) {
    return (
      <StyledPanelTable
        headers={tableHeaders}
        isLoading={false}
        visibleColumns={visibleColumns}
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

  const eventView = EventView.fromLocation(location);

  return (
    <StyledPanelTable
      headers={tableHeaders}
      isEmpty={replays?.length === 0}
      isLoading={isFetching}
      visibleColumns={visibleColumns}
    >
      {replays?.map(replay => {
        const cellProps = {
          eventView,
          organization,
          referrer,
          replay,
        };
        return (
          <Fragment key={replay.id}>
            {[
              visibleColumns.session ? (
                <TableCell key="session" column="session" {...cellProps} />
              ) : null,
              visibleColumns.projectId ? (
                <TableCell key="projectId" column="projectId" {...cellProps} />
              ) : null,
              visibleColumns.slowestTransaction ? (
                <TableCell
                  key="slowestTransaction"
                  column="slowestTransaction"
                  {...cellProps}
                />
              ) : null,
              visibleColumns.startedAt ? (
                <TableCell key="startedAt" column="startedAt" {...cellProps} />
              ) : null,
              visibleColumns.duration ? (
                <TableCell key="duration" column="duration" {...cellProps} />
              ) : null,
              visibleColumns.countErrors ? (
                <TableCell key="countErrors" column="countErrors" {...cellProps} />
              ) : null,
              visibleColumns.activity ? (
                <TableCell key="activity" column="activity" {...cellProps} />
              ) : null,
            ].filter(Boolean)}
          </Fragment>
        );
      })}
    </StyledPanelTable>
  );
}

const gridTemplateColumns = (p: {visibleColumns: VisibleColumns}) => {
  const columnCount = Object.values(p.visibleColumns).filter(Boolean).length;

  if (p.visibleColumns.session) {
    return `minmax(0, 1fr) repeat(${columnCount - 1}, max-content)`;
  }
  return `repeat(${columnCount}, max-content)`;
};

const StyledPanelTable = styled(PanelTable)<{visibleColumns: VisibleColumns}>`
  grid-template-columns: ${gridTemplateColumns};
`;

const StyledAlert = styled(Alert)`
  border-radius: 0;
  border-width: 1px 0 0 0;
  grid-column: 1/-1;
  margin-bottom: 0;
`;

export default ReplayTable;
