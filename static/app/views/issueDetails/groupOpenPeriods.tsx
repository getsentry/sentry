import styled from '@emotion/styled';
import moment from 'moment-timezone';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import {ISSUE_PROPERTY_FIELDS} from 'sentry/utils/fields';
import {useParams} from 'sentry/utils/useParams';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

export const ALL_EVENTS_EXCLUDED_TAGS = [
  'environment',
  'performance.issue_ids',
  'transaction.op',
  'transaction.status',
  ...ISSUE_PROPERTY_FIELDS,
];

interface OpenPeriodDisplayData {
  duration: string;
  end: string;
  start: string;
  title: string;
}

// TODO(snigdha): make this work for the old UI
// TODO(snigdha): suppot pagination
function IssueOpenPeriodsList() {
  const params = useParams<{groupId: string}>();
  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId: params.groupId});

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  // update the open periods to have date objects
  const openPeriods = group?.openPeriods?.map(period => ({
    ...period,
    start: new Date(period.start),
    end: period.end ? new Date(period.end) : null,
  }));

  const now = new Date();
  const getDuration = (start: Date, end?: Date) => {
    const duration = end
      ? end.getTime() - start.getTime()
      : now.getTime() - start.getTime();

    const days = Math.floor(
      (duration % (30 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000)
    );
    const hours = Math.floor((duration % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((duration % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((duration % (60 * 1000)) / 1000);

    const durationStr: string[] = [];
    if (days > 0) {
      durationStr.push(`${days} days`);
    }
    if (hours > 0) {
      durationStr.push(`${hours} hr`);
    }
    if (minutes > 0) {
      durationStr.push(`${minutes} min`);
    }
    if (seconds > 0) {
      durationStr.push(`${seconds} sec`);
    }
    return durationStr.join(', ');
  };

  if (!openPeriods) {
    return null;
  }

  const data: OpenPeriodDisplayData[] = openPeriods.map(period => ({
    title: moment(period.start).format('MMM DD'),
    start: moment(period.start).format('MMM DD, YYYY hh:mm'),
    end: period.end ? moment(period.end).format('MMM DD, YYYY hh:mm') : '—',
    duration: getDuration(period.start, period.end ?? undefined),
  }));

  const renderHeadCell = (col: GridColumnOrder) => {
    return <AlignLeft>{col.name}</AlignLeft>;
  };

  const renderBodyCell = (col: GridColumnOrder, dataRow: OpenPeriodDisplayData) => {
    return <AlignLeft>{dataRow[col.key]}</AlignLeft>;
  };

  const columnOrder: GridColumnOrder[] = [
    {key: 'title', width: COL_WIDTH_UNDEFINED, name: t('Title')},
    {key: 'start', width: COL_WIDTH_UNDEFINED, name: t('Start')},
    {key: 'end', width: COL_WIDTH_UNDEFINED, name: t('End')},
    {key: 'duration', width: COL_WIDTH_UNDEFINED, name: t('Duration')},
  ];

  return (
    <GridEditable
      isLoading={isGroupPending}
      data={data}
      columnOrder={columnOrder}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
    />
  );
}

const AlignLeft = styled('span')<{color?: string}>`
  text-align: left;
  width: 100%;
  ${p => (p.color ? `color: ${p.color};` : '')}
`;
export default IssueOpenPeriodsList;
