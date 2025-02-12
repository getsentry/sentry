import GridEditable from 'sentry/components/gridEditable';
import TimeSince from 'sentry/components/timeSince';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOurlogs} from 'sentry/views/insights/common/queries/useDiscover';
import type {OurlogsFields} from 'sentry/views/insights/types';

export type LogsTableProps = {
  search: MutableSearch;
};

export function LogsTable(props: LogsTableProps) {
  const {data, error, isPending} = useOurlogs(
    {
      limit: 100,
      sorts: [],
      fields: ['sentry.severity_text', 'sentry.body', 'sentry.timestamp'],
      search: props.search,
    },
    'api.logs-tab.view'
  );
  return (
    <GridEditable<OurlogsFields, keyof OurlogsFields>
      isLoading={isPending}
      columnOrder={[
        {key: 'sentry.severity_text', name: 'Severity', width: 60},
        {key: 'sentry.body', name: 'Body', width: 500},
        {key: 'sentry.timestamp', name: 'Timestamp', width: 90},
      ]}
      columnSortBy={[]}
      data={data}
      error={error}
      grid={{
        renderHeadCell: col => {
          return <div>{col.name}</div>;
        },
        renderBodyCell: (col, dataRow) => {
          if (col.key === 'sentry.timestamp') {
            return timestampRenderer(dataRow['sentry.timestamp']);
          }
          if (col.key === 'sentry.severity_text') {
            return severityTextRenderer(dataRow['sentry.severity_text']);
          }
          return <div>{dataRow[col.key]}</div>;
        },
      }}
    />
  );
}

function severityTextRenderer(text: string) {
  return <div>{text.toUpperCase().slice(0, 4)}</div>;
}

function timestampRenderer(timestamp: string) {
  return (
    <TimeSince unitStyle="extraShort" date={new Date(timestamp)} tooltipShowSeconds />
  );
}
