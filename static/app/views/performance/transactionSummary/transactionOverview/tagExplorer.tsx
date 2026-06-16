import type {Project} from 'sentry/types/project';
import type {EventView} from 'sentry/utils/discover/eventView';
import type {TableDataRow} from 'sentry/utils/performance/segmentExplorer/segmentExplorerQuery';
import type {SpanOperationBreakdownFilter} from 'sentry/views/performance/transactionSummary/filter';
import {SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD} from 'sentry/views/performance/transactionSummary/filter';
import {
  platformAndConditionsToPerformanceType,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

export const getTransactionField = (
  currentFilter: SpanOperationBreakdownFilter,
  projects: Project[],
  eventView: EventView
) => {
  const fieldFromFilter = SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD[currentFilter];
  if (fieldFromFilter) {
    return fieldFromFilter;
  }

  const performanceType = platformAndConditionsToPerformanceType(projects, eventView);
  if (performanceType === ProjectPerformanceType.FRONTEND) {
    return 'measurements.lcp';
  }

  return 'transaction.duration';
};

type TagValueProps = {
  row: TableDataRow;
};

export function TagValue(props: TagValueProps) {
  return <div className="truncate">{props.row.tags_value}</div>;
}
