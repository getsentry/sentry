import {Fragment, memo, useCallback} from 'react';
import styled from '@emotion/styled';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useNavigate} from 'sentry/utils/useNavigate';
import {HeadSortCell} from 'sentry/views/insights/agentMonitoring/components/headSortCell';
import {useColumnOrder} from 'sentry/views/insights/agentMonitoring/hooks/useColumnOrder';

interface TableData {
  agentFlow: string;
  duration: number;
  errors: number;
  timestamp: string;
  tokens: string;
  tools: number;
  traceId: string;
  user: string;
}

const EMPTY_ARRAY: never[] = [];

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'traceId', name: t('Trace ID'), width: 120},
  {key: 'agentFlow', name: t('Agent Flow'), width: COL_WIDTH_UNDEFINED},
  {key: 'duration', name: t('Duration'), width: 100},
  {key: 'errors', name: t('Errors'), width: 100},
  {key: 'tokens', name: t('Tokens used'), width: 140},
  {key: 'tools', name: t('Tool calls'), width: 120},
  {key: 'user', name: t('User'), width: 120},
  {key: 'timestamp', name: t('Timestamp'), width: 120},
];

export function TracesTable() {
  const navigate = useNavigate();
  const {columnOrder, onResizeColumn} = useColumnOrder(defaultColumnOrder);

  // TODO: Replace with actual request
  const tracesRequest = {
    data: [],
    isPending: false,
    error: false,
    pageLinks: null,
    isPlaceholderData: false,
  };

  const tableData = tracesRequest.data;

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <HeadSortCell column={column}>
        {column.key === 'agentFlow' && <CellExpander />}
        {column.name}
      </HeadSortCell>
    );
  }, []);

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: TableData) => {
      return <BodyCell column={column} dataRow={dataRow} />;
    },
    []
  );

  return (
    <Fragment>
      <GridEditableContainer>
        <GridEditable
          isLoading={tracesRequest.isPending}
          error={tracesRequest.error}
          data={tableData}
          columnOrder={columnOrder}
          columnSortBy={EMPTY_ARRAY}
          stickyHeader
          grid={{
            renderBodyCell,
            renderHeadCell,
            onResizeColumn,
          }}
        />
        {tracesRequest.isPlaceholderData && <LoadingOverlay />}
      </GridEditableContainer>
      <Pagination
        pageLinks={tracesRequest.pageLinks}
        onCursor={(cursor, path, currentQuery) => {
          navigate(
            {
              pathname: path,
              query: {...currentQuery, pathsCursor: cursor},
            },
            {replace: true, preventScrollReset: true}
          );
        }}
      />
    </Fragment>
  );
}

const BodyCell = memo(function BodyCell({
  column,
  dataRow,
}: {
  column: GridColumnHeader<string>;
  dataRow: TableData;
}) {
  switch (column.key) {
    case 'traceId':
      return dataRow.traceId;
    case 'agentFlow':
      return dataRow.agentFlow;
    case 'duration':
      return dataRow.duration;
    case 'errors':
      return dataRow.errors;
    case 'tokens':
      return dataRow.tokens;
    case 'tools':
      return dataRow.tools;
    case 'user':
      return dataRow.user;
    default:
      return null;
  }
});

/**
 * Used to force the cell to expand take as much width as possible in the table layout
 * otherwise grid editable will let the last column grow
 */
const CellExpander = styled('div')`
  width: 100vw;
`;

const GridEditableContainer = styled('div')`
  position: relative;
  margin-bottom: ${space(1)};
`;

const LoadingOverlay = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${p => p.theme.background};
  opacity: 0.5;
  z-index: 1;
`;
