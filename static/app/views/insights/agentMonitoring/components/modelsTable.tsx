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
  duration: number;
  errorRate: string;
  model: string;
  requests: number;
  tokens: number;
  tools: string;
}

const EMPTY_ARRAY: never[] = [];

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'model', name: t('Model'), width: COL_WIDTH_UNDEFINED},
  {key: 'requests', name: t('Requests'), width: 120},
  {key: 'duration', name: t('Duration'), width: 100},
  {key: 'errorRate', name: t('Error Rate'), width: 140},
  {key: 'tools', name: t('Tool calls'), width: 120},
  {key: 'tokens', name: t('Tokens used'), width: 140},
];

export function ModelsTable() {
  const navigate = useNavigate();
  const {columnOrder, onResizeColumn} = useColumnOrder(defaultColumnOrder);

  // TODO: Replace with actual request
  const modelsRequest = {
    data: [],
    isPending: false,
    error: false,
    pageLinks: null,
    isPlaceholderData: false,
  };

  const tableData = modelsRequest.data;

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <HeadSortCell column={column}>
        {column.key === 'model' && <CellExpander />}
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
          isLoading={modelsRequest.isPending}
          error={modelsRequest.error}
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
        {modelsRequest.isPlaceholderData && <LoadingOverlay />}
      </GridEditableContainer>
      <Pagination
        pageLinks={modelsRequest.pageLinks}
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
    case 'model':
      return dataRow.model;
    case 'requests':
      return dataRow.requests;
    case 'duration':
      return dataRow.duration;
    case 'errorRate':
      return dataRow.errorRate;
    case 'tokens':
      return dataRow.tokens;
    case 'tools':
      return dataRow.tools;
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
