import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Tooltip} from 'sentry/components/core/tooltip';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import type {Organization} from 'sentry/types/organization';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import type {TableColumn} from 'sentry/views/discover/table/types';

/**
 * Renderers here are used as a default fallback when no renderer function is supplied
 */

interface DefaultCellRenderProps {
  tableData?: TableData;
}

interface DefaultBodyCellRenderProps extends DefaultCellRenderProps {
  location: Location;
  organization: Organization;
  theme: Theme;
}

// TODO: expand on some basic sorting functionality
/** @internal */
export const renderDefaultHeadCell = ({tableData}: DefaultCellRenderProps) =>
  function (
    column: TableColumn<keyof TableDataRow>,
    _columnIndex: number
  ): React.ReactNode {
    const tableMeta = tableData?.meta;
    const align = fieldAlignment(column.name, column.type, tableMeta);

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

/** @internal */
export const renderDefaultBodyCell = ({
  tableData,
  location,
  organization,
  theme,
}: DefaultBodyCellRenderProps) =>
  function (
    column: GridColumnOrder,
    dataRow: Record<string, any>,
    rowIndex: number,
    columnIndex: number
  ): React.ReactNode {
    const columnKey = String(column.key);
    if (!tableData?.meta) {
      return dataRow[column.key];
    }

    const fieldRenderer = getFieldRenderer(columnKey, tableData.meta, false);
    const unit = tableData.meta.units?.[columnKey];

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
