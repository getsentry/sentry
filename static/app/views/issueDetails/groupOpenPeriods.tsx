import {useState} from 'react';
import {Link} from 'react-router-dom';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {getShortEventId} from 'sentry/utils/events';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useOpenPeriods} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {EventListTable} from 'sentry/views/issueDetails/streamline/eventListTable';

interface OpenPeriodDisplayData {
  duration: React.ReactNode;
  end: React.ReactNode;
  eventId: React.ReactNode;
  start: React.ReactNode;
}

// TODO(snigdha): make this work for the old UI
function IssueOpenPeriodsList() {
  const organization = useOrganization();
  const location = useLocation();
  const [now] = useState(() => new Date());
  const params = useParams<{groupId: string}>();
  const {
    data: openPeriods = [],
    isPending,
    error,
    getResponseHeader,
  } = useOpenPeriods({
    groupId: params.groupId,
    cursor: location.query?.cursor as string | undefined,
  });

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
      eventId: period.eventId ? (
        <Link
          to={`/organizations/${organization.slug}/issues/${params.groupId}/events/${period.eventId}/`}
        >
          {getShortEventId(period.eventId)}
        </Link>
      ) : (
        '—'
      ),
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

  const links = parseLinkHeader(getResponseHeader?.('Link') ?? '');
  const totalCount = getResponseHeader?.('X-Hits') ?? undefined;
  const previousDisabled = links.previous?.results === false;
  const nextDisabled = links.next?.results === false;

  return (
    <EventListTable
      title={t('All Open Periods')}
      pagination={{
        enabled: true,
        links,
        paginatorType: 'offset',
        pageCount: openPeriods.length,
        totalCount,
        previousDisabled,
        nextDisabled,
        tableUnits: t('open periods'),
      }}
    >
      <GridEditable
        isLoading={isPending}
        data={data}
        error={error}
        columnOrder={[
          {key: 'eventId', width: COL_WIDTH_UNDEFINED, name: t('Event ID')},
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
