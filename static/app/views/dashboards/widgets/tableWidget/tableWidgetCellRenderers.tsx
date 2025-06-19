import {Fragment} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Tooltip} from 'sentry/components/core/tooltip';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getIssueFieldRenderer} from 'sentry/utils/dashboards/issueFieldRenderers';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment, getAggregateAlias} from 'sentry/utils/discover/fields';
import {getCustomEventsFieldRenderer} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  FieldKey,
  ISSUE_FIELD_TO_HEADER_MAP,
  ISSUE_FIELDS,
} from 'sentry/views/dashboards/widgetBuilder/issueWidget/fields';
import {TransactionLink} from 'sentry/views/discover/table/tableView';
import {TopResultsIndicator} from 'sentry/views/discover/table/topResultsIndicator';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {getTargetForTransactionSummaryLink} from 'sentry/views/discover/utils';

/**
 * Renderers here are meant to be used for widgets that render in the dashboard related pages
 */

// Dashboards only supports top 5 for now
const DEFAULT_NUM_TOP_EVENTS = 5;

interface SharedRenderTableProps {
  widget: Widget;
  tableData?: TableData;
}

interface RenderGridBodyProps extends SharedRenderTableProps {
  location: Location;
  organization: Organization;
  theme: Theme;
  eventView?: EventView;
  isFirstPage?: boolean;
  projects?: Project[];
}

interface RenderGridHeadProps extends SharedRenderTableProps {
  onHeaderClick?: () => void;
}

export const renderGridHeaderCell = ({tableData}: RenderGridHeadProps) =>
  function (
    column: TableColumn<keyof TableDataRow>,
    _columnIndex: number
  ): React.ReactNode {
    const tableMeta = tableData?.meta;
    const align = fieldAlignment(column.name, column.type, tableMeta);

    const formattedName =
      column.name === FieldKey.LIFETIME_EVENTS || column.name === FieldKey.LIFETIME_USERS
        ? ISSUE_FIELD_TO_HEADER_MAP[column.name]
        : column.name;

    return (
      <SortLink
        align={align}
        title={<StyledTooltip title={formattedName}>{formattedName}</StyledTooltip>}
        direction={undefined}
        canSort={false}
        preventScrollReset
        generateSortLink={() => undefined}
      />
    );
  };

export const renderGridBodyCell = ({
  location,
  organization,
  widget,
  tableData,
  isFirstPage,
  projects,
  eventView,
  theme,
}: RenderGridBodyProps) =>
  function (
    column: GridColumnOrder,
    dataRow: Record<string, any>,
    rowIndex: number,
    columnIndex: number
  ): React.ReactNode {
    const columnKey = String(column.key);
    const isTopEvents = widget.displayType === DisplayType.TOP_N;
    let cell: React.ReactNode;
    switch (widget.widgetType) {
      case WidgetType.ISSUE:
        cell = (
          getIssueFieldRenderer(columnKey) ?? getFieldRenderer(columnKey, ISSUE_FIELDS)
        )(dataRow, {organization, location, theme});
        break;
      case WidgetType.DISCOVER:
      case WidgetType.TRANSACTIONS:
      case WidgetType.ERRORS:
      default: {
        if (!tableData?.meta) {
          return dataRow[column.key];
        }
        const unit = tableData.meta.units?.[column.key];
        cell = getCustomEventsFieldRenderer(
          columnKey,
          tableData.meta,
          widget
        )(dataRow, {
          organization,
          location,
          eventView,
          unit,
          theme,
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
    }

    if (columnKey === 'transaction' && dataRow.transaction) {
      cell = (
        <TransactionLink
          data-test-id="widget-viewer-transaction-link"
          to={getTargetForTransactionSummaryLink(
            dataRow,
            organization,
            projects,
            eventView
          )}
        >
          {cell}
        </TransactionLink>
      );
    }

    const topResultsCount = tableData
      ? Math.min(tableData?.data.length, DEFAULT_NUM_TOP_EVENTS)
      : DEFAULT_NUM_TOP_EVENTS;
    return (
      <Fragment>
        {isTopEvents &&
        isFirstPage &&
        rowIndex < DEFAULT_NUM_TOP_EVENTS &&
        columnIndex === 0 ? (
          <TopResultsIndicator count={topResultsCount} index={rowIndex} />
        ) : null}
        {cell}
      </Fragment>
    );
  };

const StyledTooltip = styled(Tooltip)`
  display: initial;
`;
