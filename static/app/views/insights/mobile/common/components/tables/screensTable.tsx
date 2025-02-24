import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {
  GridColumn,
  GridColumnHeader,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Pagination from 'sentry/components/pagination';
import {Tooltip} from 'sentry/components/tooltip';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {PercentChangeCell} from 'sentry/views/insights/common/components/tableCells/percentChangeCell';
import type {ModuleName} from 'sentry/views/insights/types';

type Props = {
  columnNameMap: Record<string, string>;
  columnOrder: string[];
  columnTooltipMap: Record<string, string> | undefined;
  data: TableData | undefined;
  defaultSort: Array<GridColumnSortBy<string>>;
  eventView: EventView;
  isLoading: boolean;
  pageLinks: string | undefined;
  customBodyCellRenderer?: (
    column: GridColumn<string>,
    row: TableDataRow
  ) => React.ReactNode;
  moduleName?: ModuleName;
};

export function ScreensTable({
  data,
  eventView,
  isLoading,
  pageLinks,
  columnNameMap,
  columnOrder,
  columnTooltipMap,
  defaultSort,
  customBodyCellRenderer,
  moduleName,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  function renderBodyCell(
    column: GridColumn<string>,
    row: TableDataRow
  ): React.ReactNode {
    if (!data?.meta || !data?.meta.fields) {
      return row[column.key];
    }

    if (defined(customBodyCellRenderer)) {
      const customRenderedCell = customBodyCellRenderer(column, row);
      if (defined(customRenderedCell)) {
        return customRenderedCell;
      }
    }

    if (data.meta.fields[column.key] === 'percent_change') {
      return (
        <PercentChangeCell
          deltaValue={parseFloat(row[column.key] as string) || 0}
          preferredPolarity="-"
        />
      );
    }

    const renderer = getFieldRenderer(column.key, data?.meta.fields, false);
    return renderer(row, {
      location,
      organization,
      unit: data?.meta.units?.[column.key],
    });
  }

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    const fieldType = data?.meta?.fields?.[column.key];
    const alignment = fieldAlignment(column.key as string, fieldType);
    const field = {
      field: column.key as string,
      width: column.width,
    };

    function generateSortLink() {
      if (!data?.meta) {
        return undefined;
      }

      const nextEventView = eventView.sortOnField(field, data?.meta);
      const queryStringObject = nextEventView.generateQueryStringObject();

      return {
        ...location,
        query: {...location.query, sort: queryStringObject.sort},
      };
    }

    const currentSort = eventView.sortForField(field, data?.meta);
    const currentSortKind = currentSort ? currentSort.kind : undefined;
    const canSort = isFieldSortable(field, data?.meta);

    const sortLink = (
      <SortLink
        align={alignment}
        title={column.name}
        direction={currentSortKind}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );

    function columnWithTooltip(tooltipTitle: string) {
      return (
        <Alignment align={alignment}>
          <StyledTooltip isHoverable title={<span>{tooltipTitle}</span>}>
            {sortLink}
          </StyledTooltip>
        </Alignment>
      );
    }

    const tooltip = columnTooltipMap ? columnTooltipMap[column.key] : undefined;
    if (tooltip) {
      return columnWithTooltip(tooltip);
    }
    return sortLink;
  }

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading}
        data={data?.data as TableDataRow[]}
        columnOrder={columnOrder.map(columnKey => {
          return {
            key: columnKey,
            name: columnNameMap[columnKey]!,
            width: COL_WIDTH_UNDEFINED,
          };
        })}
        columnSortBy={defaultSort}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
      />
      <Pagination
        pageLinks={pageLinks}
        paginationAnalyticsEvent={(direction: string) => {
          if (moduleName !== undefined) {
            trackAnalytics('insight.general.table_paginate', {
              organization,
              source: moduleName,
              direction,
            });
          }
        }}
      />
    </Fragment>
  );
}

const Alignment = styled('span')<{align: string}>`
  display: block;
  margin: auto;
  text-align: ${props => props.align};
  width: 100%;
`;

const StyledTooltip = styled(Tooltip)`
  top: 1px;
  position: relative;
`;
