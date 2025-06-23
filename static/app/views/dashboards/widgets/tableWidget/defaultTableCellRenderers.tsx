import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Tooltip} from 'sentry/components/core/tooltip';
import type {Alignments} from 'sentry/components/gridEditable/sortLink';
import type {Organization} from 'sentry/types/organization';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {ColumnValueType} from 'sentry/utils/discover/fields';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import type {
  TabularColumn,
  TabularData,
  TabularRow,
} from 'sentry/views/dashboards/widgets/common/types';

interface DefaultHeadCellRenderProps {
  renderTableHeadCell?: (
    column: TabularColumn,
    columnIndex: number
  ) => React.ReactNode | undefined;
}

export const renderDefaultHeadCell = ({
  renderTableHeadCell,
}: DefaultHeadCellRenderProps) =>
  function (
    column: TabularColumn<keyof TabularRow>,
    _columnIndex: number
  ): React.ReactNode {
    const cell = renderTableHeadCell?.(column, _columnIndex);
    if (cell) {
      return cell;
    }
    const align = fieldAlignment(column.name, column.type as ColumnValueType);

    return (
      <CellWrapper align={align}>
        <StyledTooltip title={column.name}>{column.name}</StyledTooltip>
      </CellWrapper>
    );
  };

interface DefaultBodyCellRenderProps {
  location: Location;
  organization: Organization;
  theme: Theme;
  renderTableBodyCell?: (
    column: TabularColumn,
    dataRow: TabularRow,
    rowIndex: number,
    columnIndex: number
  ) => React.ReactNode | undefined;
  tableData?: TabularData;
}

export const renderDefaultBodyCell = ({
  tableData,
  location,
  organization,
  theme,
  renderTableBodyCell,
}: DefaultBodyCellRenderProps) =>
  function (
    column: TabularColumn,
    dataRow: TabularRow,
    rowIndex: number,
    columnIndex: number
  ): React.ReactNode {
    const cell = renderTableBodyCell?.(column, dataRow, rowIndex, columnIndex);
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

const CellWrapper = styled('div')<{align: Alignments}>`
  display: block;
  width: 100%;
  white-space: nowrap;
  ${(p: {align: Alignments}) => (p.align ? `text-align: ${p.align};` : '')}
`;
