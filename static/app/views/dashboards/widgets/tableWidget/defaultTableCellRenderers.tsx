import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Tooltip} from 'sentry/components/core/tooltip';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import type {Organization} from 'sentry/types/organization';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {ColumnValueType} from 'sentry/utils/discover/fields';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import type {
  TabularColumn,
  TabularData,
  TabularRow,
} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Renderers that use any supplied renderer, but fallback to default rendering if none are provided
 */
interface DefaultHeadCellRenderProps {
  renderTableHeadCell?: (
    column: GridColumnOrder,
    columnIndex: number
  ) => React.ReactNode | undefined;
}

interface DefaultBodyCellRenderProps {
  location: Location;
  organization: Organization;
  theme: Theme;
  renderTableBodyCell?: (
    column: GridColumnOrder,
    dataRow: Record<string, any>,
    rowIndex: number,
    columnIndex: number
  ) => React.ReactNode | undefined;
  tableData?: TabularData;
}

// TODO: expand on some basic sorting functionality
export const renderDefaultHeadCell = ({
  renderTableHeadCell,
}: DefaultHeadCellRenderProps) =>
  function (
    column: TabularColumn<keyof TabularRow>,
    _columnIndex: number
  ): React.ReactNode {
    const cell: React.ReactNode = renderTableHeadCell?.(column, _columnIndex);
    if (cell) {
      return cell;
    }
    const align = fieldAlignment(column.name, column.type as ColumnValueType);

    return (
      <SortLink
        align={align}
        title={<StyledTooltip title={column.name}>{column.name}</StyledTooltip>}
        direction={undefined}
        canSort={false}
        preventScrollReset
        generateSortLink={() => undefined}
      />
    );
  };

export const renderDefaultBodyCell = ({
  tableData,
  location,
  organization,
  theme,
  renderTableBodyCell,
}: DefaultBodyCellRenderProps) =>
  function (
    column: TabularColumn,
    dataRow: Record<string, any>,
    rowIndex: number,
    columnIndex: number
  ): React.ReactNode {
    const cell: React.ReactNode = renderTableBodyCell?.(
      column,
      dataRow,
      rowIndex,
      columnIndex
    );
    if (cell) {
      return cell;
    }

    const columnKey = String(column.key);
    if (!tableData?.meta) {
      return dataRow[column.key];
    }

    const fieldRenderer = getFieldRenderer(columnKey, tableData.meta.fields, false);
    const unit = tableData.meta.units?.[columnKey] as string;

    return (
      <div key={`${rowIndex}-${columnIndex}:${column.name}`}>
        {fieldRenderer(dataRow, {
          organization,
          location,
          unit,
          theme,
        })}
      </div>
    );
  };

const StyledTooltip = styled(Tooltip)`
  display: initial;
`;
