import {Fragment} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Tooltip} from 'sentry/components/core/tooltip';
import SortLink from 'sentry/components/gridEditable/sortLink';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getIssueFieldRenderer} from 'sentry/utils/dashboards/issueFieldRenderers';
import type EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {ColumnValueType} from 'sentry/utils/discover/fields';
import {fieldAlignment, getAggregateAlias} from 'sentry/utils/discover/fields';
import {getCustomEventsFieldRenderer} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  FieldKey,
  ISSUE_FIELD_TO_HEADER_MAP,
  ISSUE_FIELDS,
} from 'sentry/views/dashboards/widgetBuilder/issueWidget/fields';
import type {
  TabularColumn,
  TabularData,
  TabularRow,
} from 'sentry/views/dashboards/widgets/common/types';
import {TransactionLink} from 'sentry/views/discover/table/tableView';
import {TopResultsIndicator} from 'sentry/views/discover/table/topResultsIndicator';
import {getTargetForTransactionSummaryLink} from 'sentry/views/discover/utils';

// Dashboards only supports top 5 for now
const DEFAULT_NUM_TOP_EVENTS = 5;

interface RenderGridBodyProps {
  widget: Widget;
  eventView?: EventView;
  isFirstPage?: boolean;
  location?: Location;
  organization?: Organization;
  projects?: Project[];
  tableData?: TabularData;
  theme?: Theme;
}

export const renderGridHeaderCell = () =>
  function (column: TabularColumn, _columnIndex: number): React.ReactNode {
    const align = fieldAlignment(column.name, column.type as ColumnValueType);

    const formattedName =
      column.name === FieldKey.LIFETIME_EVENTS || column.name === FieldKey.LIFETIME_USERS
        ? ISSUE_FIELD_TO_HEADER_MAP[column.name]
        : column.name;

    return (
      // Sorting will be added later
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
    column: TabularColumn,
    dataRow: TabularRow,
    rowIndex: number,
    columnIndex: number
  ): React.ReactNode {
    if (!organization || !location || !theme) {
      return undefined;
    }
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
        const unit = tableData.meta.units?.[column.key] as string | undefined;
        cell = getCustomEventsFieldRenderer(
          columnKey,
          tableData.meta.fields,
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
        if (
          tableData.meta.fields[fieldName] === 'integer' &&
          defined(value) &&
          typeof value === 'number' &&
          value > 999
        ) {
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
