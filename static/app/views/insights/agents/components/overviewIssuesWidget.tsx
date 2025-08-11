import type {
  TabularColumn,
  TabularMeta,
} from 'sentry/views/dashboards/widgets/common/types';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import {useErrors} from 'sentry/views/insights/common/queries/useDiscover';
import {ErrorField} from 'sentry/views/insights/types';

const columns: TabularColumn[] = [
  {key: 'issue', sortable: false},
  {key: 'title', sortable: false},
  {key: 'count()', sortable: false},
];

export function OverviewIssuesWidget() {
  const {data, meta, isLoading} = useErrors(
    {
      fields: [ErrorField.ISSUE, ErrorField.TITLE, 'count()'],
      sorts: [{field: 'count()', kind: 'desc'}],
      limit: 6,
    },
    'api.insights.overview-issues-widget'
  );

  if (isLoading) {
    return <TableWidgetVisualization.LoadingPlaceholder columns={columns} />;
  }

  const tableData = {
    data,
    meta: {fields: {...meta?.fields}, units: {...meta?.units}} as TabularMeta, // TODO: ideally this is properly typed, but EventsMeta doesn't match TabularMeta even tho they seem like they should
  };

  return <TableWidgetVisualization tableData={tableData} columns={columns} />;
}
