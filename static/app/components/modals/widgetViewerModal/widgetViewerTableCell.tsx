import * as React from 'react';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject} from 'history';

import {GridColumnOrder} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Tooltip from 'sentry/components/tooltip';
import {Organization, PageFilters} from 'sentry/types';
import {defined} from 'sentry/utils';
import {
  getIssueFieldRenderer,
  getSortField,
} from 'sentry/utils/dashboards/issueFieldRenderers';
import {TableDataRow, TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  fieldAlignment,
  getAggregateAlias,
  getEquationAliasIndex,
  isEquationAlias,
} from 'sentry/utils/discover/fields';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import {eventViewFromWidget} from 'sentry/views/dashboardsV2/utils';
import {ISSUE_FIELDS} from 'sentry/views/dashboardsV2/widgetBuilder/issueWidget/fields';
import TopResultsIndicator from 'sentry/views/eventsV2/table/topResultsIndicator';
import {TableColumn} from 'sentry/views/eventsV2/table/types';

import {WidgetViewerQueryField} from './utils';
// Dashboards only supports top 5 for now
const DEFAULT_NUM_TOP_EVENTS = 5;

type Props = {
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  isFirstPage?: boolean;
  tableData?: TableDataWithTitle;
};

export const renderIssueGridHeaderCell =
  ({location, widget, tableData}: Props) =>
  (column: TableColumn<keyof TableDataRow>, _columnIndex: number): React.ReactNode => {
    const tableMeta = tableData?.meta;
    const align = fieldAlignment(column.name, column.type, tableMeta);
    const sortField = getSortField(String(column.key));

    return (
      <SortLink
        align={align}
        title={<StyledTooltip title={column.name}>{column.name}</StyledTooltip>}
        direction={widget.queries[0].orderby === sortField ? 'desc' : undefined}
        canSort={!!sortField}
        generateSortLink={() => ({
          ...location,
          query: {...location.query, [WidgetViewerQueryField.SORT]: sortField},
        })}
      />
    );
  };

export const renderDiscoverGridHeaderCell =
  ({location, selection, widget, tableData}: Props) =>
  (column: TableColumn<keyof TableDataRow>, _columnIndex: number): React.ReactNode => {
    const eventView = eventViewFromWidget(
      widget.title,
      widget.queries[0],
      selection,
      widget.displayType
    );
    const tableMeta = tableData?.meta;
    const align = fieldAlignment(column.name, column.type, tableMeta);
    const field = {field: String(column.key), width: column.width};
    function generateSortLink(): LocationDescriptorObject | undefined {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = eventView.sortOnField(field, tableMeta);
      const queryStringObject = nextEventView.generateQueryStringObject();

      return {
        ...location,
        query: {...location.query, [WidgetViewerQueryField.SORT]: queryStringObject.sort},
      };
    }

    const currentSort = eventView.sortForField(field, tableMeta);
    const canSort = isFieldSortable(field, tableMeta);
    const titleText = isEquationAlias(column.name)
      ? eventView.getEquations()[getEquationAliasIndex(column.name)]
      : column.name;

    return (
      <SortLink
        align={align}
        title={<StyledTooltip title={titleText}>{titleText}</StyledTooltip>}
        direction={currentSort ? currentSort.kind : undefined}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
  };

export const renderGridBodyCell =
  ({location, organization, widget, tableData, isFirstPage}: Props) =>
  (
    column: GridColumnOrder,
    dataRow: Record<string, any>,
    rowIndex: number,
    columnIndex: number
  ): React.ReactNode => {
    const columnKey = String(column.key);
    const isTopEvents = widget.displayType === DisplayType.TOP_N;
    let cell: React.ReactNode;
    switch (widget.widgetType) {
      case WidgetType.ISSUE:
        cell = (
          getIssueFieldRenderer(columnKey) ?? getFieldRenderer(columnKey, ISSUE_FIELDS)
        )(dataRow, {organization, location});
        break;
      case WidgetType.DISCOVER:
      default:
        if (!tableData || !tableData.meta) {
          return dataRow[column.key];
        }
        cell = getFieldRenderer(columnKey, tableData.meta)(dataRow, {
          organization,
          location,
        });

        const fieldName = getAggregateAlias(columnKey);
        const value = dataRow[fieldName];
        if (tableData.meta[fieldName] === 'integer' && defined(value) && value > 999) {
          return (
            <Tooltip
              title={value.toLocaleString()}
              containerDisplayMode="block"
              position="right"
            >
              {cell}
            </Tooltip>
          );
        }
        break;
    }

    return (
      <React.Fragment>
        {isTopEvents &&
        isFirstPage &&
        rowIndex < DEFAULT_NUM_TOP_EVENTS &&
        columnIndex === 0 ? (
          <TopResultsIndicator count={DEFAULT_NUM_TOP_EVENTS} index={rowIndex} />
        ) : null}
        {cell}
      </React.Fragment>
    );
  };

const StyledTooltip = styled(Tooltip)`
  display: initial;
`;
