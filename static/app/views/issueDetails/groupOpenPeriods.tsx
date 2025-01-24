import {useState} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useParams} from 'sentry/utils/useParams';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

type OpenPeriodDisplayData = {
  duration: React.ReactNode;
  end: React.ReactNode;
  start: React.ReactNode;
  title: React.ReactNode;
};

// TODO(snigdha): make this work for the old UI
// TODO(snigdha): support pagination
function IssueOpenPeriodsList() {
  const [now] = useState(() => new Date());
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

  if (isGroupPending) {
    return <LoadingIndicator />;
  }

  // update the open periods to have date objects
  const openPeriods = group.openPeriods?.map(period => ({
    ...period,
    start: new Date(period.start),
    end: period.end ? new Date(period.end) : null,
  }));

  const getDuration = (start: Date, end?: Date) => {
    const duration = end
      ? (end.getTime() - start.getTime()) / 1000
      : (now.getTime() - start.getTime()) / 1000;

    return <Duration seconds={duration} precision="minutes" exact />;
  };

  if (!openPeriods) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  const data: OpenPeriodDisplayData[] = openPeriods.map(period => ({
    title: <DateTime date={period.start} />,
    start: <DateTime date={period.start} />,
    end: period.end ? <DateTime date={period.end} /> : '—',
    duration: getDuration(period.start, period.end ?? undefined),
  }));

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
    <GridEditable
      isLoading={isGroupPending}
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
  );
}

const AlignLeft = styled('span')`
  text-align: left;
  width: 100%;
`;
export default IssueOpenPeriodsList;
