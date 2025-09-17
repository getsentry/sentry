import {useState} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {useParams} from 'sentry/utils/useParams';
import {useOpenPeriods} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {EventListTable} from 'sentry/views/issueDetails/streamline/eventListTable';

interface OpenPeriodDisplayData {
  duration: React.ReactNode;
  end: React.ReactNode;
  start: React.ReactNode;
  title: React.ReactNode;
}

// TODO(snigdha): make this work for the old UI
// TODO(snigdha): support pagination
function IssueOpenPeriodsList() {
  const [now] = useState(() => new Date());
  const params = useParams<{groupId: string}>();
  const {
    data: openPeriods,
    isPending,
    isError,
    refetch,
  } = useOpenPeriods({
    groupId: params.groupId,
  });

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  const getDuration = (start: Date, end?: Date) => {
    const duration = end
      ? (end.getTime() - start.getTime()) / 1000
      : (now.getTime() - start.getTime()) / 1000;

    return <Duration seconds={duration} precision="minutes" exact />;
  };

  const data: OpenPeriodDisplayData[] = openPeriods.map(period => {
    const startDate = new Date(period.start);
    const endDate = period.end ? new Date(period.end) : undefined;

    return {
      title: <DateTime date={startDate} />,
      start: <DateTime date={startDate} />,
      end: endDate ? <DateTime date={endDate} /> : '—',
      duration: getDuration(startDate, endDate),
    };
  });

  const renderHeadCell = (col: GridColumnOrder) => {
    return <AlignLeft>{col.name}</AlignLeft>;
  };

  const renderBodyCell = (
    col: GridColumnOrder<string>,
    dataRow: OpenPeriodDisplayData
  ) => {
    const column = col.key as keyof OpenPeriodDisplayData;
    return <AlignLeft>{dataRow[column]}</AlignLeft>;
  };

  return (
    <EventListTable title={t('All Open Periods')} pagination={{enabled: false}}>
      <GridEditable
        isLoading={isPending}
        data={data}
        columnOrder={[
          {key: 'title', width: COL_WIDTH_UNDEFINED, name: t('Title')},
          {key: 'start', width: COL_WIDTH_UNDEFINED, name: t('Start')},
          {key: 'end', width: COL_WIDTH_UNDEFINED, name: t('End')},
          {key: 'duration', width: COL_WIDTH_UNDEFINED, name: t('Duration')},
        ]}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
      />
    </EventListTable>
  );
}

const AlignLeft = styled('span')`
  text-align: left;
  width: 100%;
`;
export default IssueOpenPeriodsList;
