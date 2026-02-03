import {Link} from 'react-router-dom';
import styled from '@emotion/styled';
import orderBy from 'lodash/orderBy';

import {DateTime} from 'sentry/components/dateTime';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import type {GroupOpenPeriodActivity} from 'sentry/types/group';
import {getShortEventId} from 'sentry/utils/events';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {unreachable} from 'sentry/utils/unreachable';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useOpenPeriods} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {EventListTable} from 'sentry/views/issueDetails/streamline/eventListTable';

interface OpenPeriodDisplayData {
  description: string;
  end: React.ReactNode;
  eventId: React.ReactNode;
  start: React.ReactNode;
}

function getOpenPeriodActivityTypeLabel(activity: GroupOpenPeriodActivity): string {
  switch (activity.type) {
    case 'opened':
      return t('Issue regressed');
    case 'closed':
      return t('Resolved');
    case 'status_change':
      return t('Priority updated to %s', activity.value);
    default:
      unreachable(activity.type);
      return t('Updated');
  }
}

// TODO(snigdha): make this work for the old UI
function IssueOpenPeriodsList() {
  const organization = useOrganization();
  const location = useLocation();
  const params = useParams<{groupId: string}>();
  const {
    data: openPeriods = [],
    isPending,
    error,
    getResponseHeader,
  } = useOpenPeriods({
    groupId: params.groupId,
    cursor: location.query?.cursor as string | undefined,
    limit: 10,
  });

  const data: OpenPeriodDisplayData[] = openPeriods.flatMap(period => {
    const periodActivities = orderBy(
      period.activities.filter(activity => activity.type !== 'closed'),
      'dateCreated',
      'desc'
    );

    return periodActivities.map((activity, index) => {
      const startDate = new Date(activity.dateCreated);
      const endDate =
        index === 0 ? (period.end ? new Date(period.end) : undefined) : undefined;

      return {
        openPeriod: activity.type === 'opened' ? `#${period.id}` : undefined,
        eventId: activity.eventId ? (
          <Link
            to={`/organizations/${organization.slug}/issues/${params.groupId}/events/${activity.eventId}/`}
          >
            {getShortEventId(activity.eventId)}
          </Link>
        ) : (
          '—'
        ),
        description: getOpenPeriodActivityTypeLabel(activity),
        start: <DateTime date={startDate} />,
        end: endDate ? <DateTime date={endDate} /> : undefined,
      };
    });
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
          {key: 'openPeriod', width: COL_WIDTH_UNDEFINED, name: t('Open Period')},
          {key: 'eventId', width: 100, name: t('Event ID')},
          {key: 'description', width: COL_WIDTH_UNDEFINED, name: t('Description')},
          {key: 'start', width: COL_WIDTH_UNDEFINED, name: t('Start')},
          {key: 'end', width: COL_WIDTH_UNDEFINED, name: t('End')},
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
