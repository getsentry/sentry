import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {
  TabularColumn,
  TabularMeta,
} from 'sentry/views/dashboards/widgets/common/types';
import {
  TableWidgetVisualization,
  type FieldRenderer,
  type FieldRendererGetter,
} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import {useErrors} from 'sentry/views/insights/common/queries/useDiscover';
import {Referrer} from 'sentry/views/insights/pages/frontend/referrers';
import {ErrorField, type ErrorResponse} from 'sentry/views/insights/types';

const COLUMNS: TabularColumn[] = [
  {key: 'issue', sortable: false},
  {key: 'last_seen()', sortable: false, width: 50},
];

const ALIASES: Record<string, string> = {
  'last_seen()': 'Last Seen',
};

export function OverviewIssuesWidget() {
  const {data, meta, isLoading} = useErrors(
    {
      fields: [ErrorField.ISSUE_ID, ErrorField.TITLE, 'last_seen()', 'epm()'],
      sorts: [{field: 'epm()', kind: 'desc'}],
      limit: 6,
    },
    Referrer.OVERVIEW_ISSUES_WIDGET
  );

  if (isLoading) {
    return (
      <TableWidgetVisualization.LoadingPlaceholder columns={COLUMNS} aliases={ALIASES} />
    );
  }

  const newData = data.map(item => ({
    ...item,
    issue: item.title, // TODO: this is a hack so the cell action shows `open issue` instead of `open link` https://github.com/getsentry/sentry/blob/1225b437d5b52b332163ea52dc4a3e26d6177e12/static/app/views/discover/table/cellAction.tsx#L307-L327
  }));

  const tableData = {
    data: newData,
    meta: {fields: {...meta?.fields}, units: {...meta?.units}} as TabularMeta, // TODO: ideally this is properly typed, but EventsMeta doesn't match TabularMeta even tho they seem like they should
  };

  return (
    <TableWidgetVisualization
      tableData={tableData}
      columns={COLUMNS}
      aliases={ALIASES}
      getRenderer={getRenderer}
    />
  );
}

const lastSeenRenderer: FieldRenderer = (data, _baggage) => {
  const dataObj = data as ErrorResponse;
  return <TimeSince date={dataObj['last_seen()']} />;
};

const titleRenderer: FieldRenderer = (data, baggage) => {
  const dataObj = data as ErrorResponse;
  const {organization} = baggage;
  const issueUrl = normalizeUrl(
    `/organizations/${organization.slug}/issues/${dataObj['issue.id']}/`
  );

  return (
    <Tooltip title={dataObj.title} containerDisplayMode="block" showOnlyOnOverflow>
      <Link to={issueUrl}>
        <TextOverflow>{dataObj.title}</TextOverflow>
      </Link>
    </Tooltip>
  );
};

const getRenderer: FieldRendererGetter = (field, _data, meta) => {
  if (field === 'last_seen()') {
    return lastSeenRenderer;
  }
  if (field === 'issue') {
    return titleRenderer;
  }
  return getFieldRenderer(field, meta.fields, false);
};
