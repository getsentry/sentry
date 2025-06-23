import {Fragment} from 'react';
import type {Theme} from '@emotion/react';
import type {Location} from 'history';

import {Tooltip} from 'sentry/components/core/tooltip';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import type EventView from 'sentry/utils/discover/eventView';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {ISSUE_FIELDS} from 'sentry/views/dashboards/widgetBuilder/issueWidget/fields';
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

interface EventViewBasedCellProps {
  eventView: EventView;
  getCustomFieldRenderer?: (
    field: string,
    meta: MetaType,
    organization?: Organization
  ) => ReturnType<typeof getFieldRenderer> | null;
  location?: Location;
  organization?: Organization;
  projects?: Project[];
  tableData?: TabularData;
  theme?: Theme;
  topResultsIndicators?: number;
}

export const renderEventViewBasedBodyCell = ({
  tableData,
  organization,
  eventView,
  theme,
  getCustomFieldRenderer,
  location,
  projects,
  topResultsIndicators,
}: EventViewBasedCellProps) => {
  return function (
    column: TabularColumn,
    dataRow: TabularRow,
    rowIndex: number,
    columnIndex: number
  ): React.ReactNode {
    if (!tableData || !location || !organization || !theme) return undefined;
    const tableMeta = tableData?.meta;
    const fieldRenderer = getCustomFieldRenderer?.(
      column.key,
      tableMeta.fields,
      organization
    );
    const unit = tableMeta.units?.[column.key] as string | undefined;
    let cell = fieldRenderer?.(dataRow, {
      organization,
      location,
      eventView,
      unit,
      theme,
    });
    if (!cell) return undefined;

    const fieldName = getAggregateAlias(column.key);
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

    if (column.key === 'transaction' && dataRow.transaction) {
      cell = (
        <TransactionLink
          to={getTargetForTransactionSummaryLink(
            dataRow,
            organization,
            projects,
            eventView,
            location
          )}
        >
          {cell}
        </TransactionLink>
      );
    }

    return (
      <Fragment key={`${rowIndex}-${columnIndex}:${column.name}`}>
        {topResultsIndicators &&
          columnIndex === 0 &&
          topResultsIndicators <= DEFAULT_NUM_TOP_EVENTS && (
            <TopResultsIndicator count={topResultsIndicators} index={rowIndex} />
          )}
        {cell}
      </Fragment>
    );
  };
};

export const renderIssuesBodyCell = ({
  tableData,
  organization,
  eventView,
  theme,
  getCustomFieldRenderer,
  location,
}: EventViewBasedCellProps) => {
  return function (
    column: TabularColumn,
    dataRow: TabularRow,
    _rowIndex: number,
    _columnIndex: number
  ): React.ReactNode {
    if (!tableData || !location || !organization || !theme) return undefined;
    const tableMeta = tableData.meta;

    const fieldRenderer =
      getCustomFieldRenderer?.(column.key, tableMeta.fields, organization) ??
      getFieldRenderer(column.key, ISSUE_FIELDS);

    const unit = tableMeta.units?.[column.key] as string | undefined;
    const cell = fieldRenderer(dataRow, {organization, location, eventView, unit, theme});

    return cell;
  };
};
