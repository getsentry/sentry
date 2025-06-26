import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import type {
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import GridEditable from 'sentry/components/tables/gridEditable';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useTableSortParams} from 'sentry/views/insights/agentMonitoring/components/headSortCell';

type ObjectKey = string | number;

interface PlatformInsightsTableProps<
  DataRow extends Record<string, any>,
  ColumnKey extends ObjectKey = string,
> extends Omit<
    React.ComponentProps<typeof GridEditable<DataRow, ColumnKey>>,
    'columnOrder' | 'columnSortBy'
  > {
  cursorParamName: string;
  initialColumnOrder:
    | Array<GridColumnOrder<ColumnKey>>
    | (() => Array<GridColumnOrder<ColumnKey>>);
  pageLinks: string | undefined;
  isPlaceholderData?: boolean;
}

const COL_WIDTH_MINIMUM = 120;

export function PlatformInsightsTable<
  DataRow extends Record<string, any>,
  ColumnKey extends ObjectKey = string,
>({
  cursorParamName,
  pageLinks,
  isPlaceholderData,
  initialColumnOrder,
  ...props
}: PlatformInsightsTableProps<DataRow, ColumnKey>) {
  const navigate = useNavigate();
  const [columnOrder, setColumnOrder] = useState(initialColumnOrder);
  const {sortField, sortOrder} = useTableSortParams();

  const handleResizeColumn = useCallback(
    (columnIndex: number, nextColumn: GridColumnHeader<ColumnKey>) => {
      setColumnOrder(prev => {
        const newColumnOrder = [...prev];
        newColumnOrder[columnIndex] = {
          ...newColumnOrder[columnIndex]!,
          width: nextColumn.width,
        };
        return newColumnOrder;
      });
    },
    []
  );

  const handleCursor = useCallback<CursorHandler>(
    (cursor, pathname, previousQuery) => {
      navigate(
        {
          pathname,
          query: {...previousQuery, [cursorParamName]: cursor},
        },
        {replace: true, preventScrollReset: true}
      );
    },
    [cursorParamName, navigate]
  );

  return (
    <Fragment>
      <GridEditableContainer>
        <GridEditable
          {...props}
          grid={{...props.grid, onResizeColumn: handleResizeColumn}}
          columnOrder={columnOrder}
          columnSortBy={[{key: sortField as ColumnKey, order: sortOrder}]}
          minimumColWidth={COL_WIDTH_MINIMUM}
          emptyMessage={
            <EmptyMessage size="large" icon={<IconSearch size="xl" />}>
              {t('No results found')}
            </EmptyMessage>
          }
          stickyHeader
        />
        {isPlaceholderData && <LoadingOverlay />}
      </GridEditableContainer>
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}

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
